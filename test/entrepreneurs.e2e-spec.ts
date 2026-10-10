import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../src/app.module.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { Entrepreneur } from '../src/entrepreneurs/entities/entrepreneur.entity.js';

describe('Entrepreneurs (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;

  const ADMIN = { email: 'admin-e2e@mc.local', password: 'AdminE2E123' };
  const ENT = { email: 'emp-e2e@mc.local', password: 'EmpE2E12345' };
  const OTHER = { email: 'other-e2e@mc.local', password: 'OtherE2E123' };

  let adminToken: string;
  let entToken: string;
  let otherToken: string;

  const sample = (name: string) => ({
    name,
    description: 'Cosmeticos artesanales elaborados con ingredientes naturales locales.',
    category: 'Cosmetica',
  });

  async function register(body: { email: string; password: string; name?: string }) {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...body, name: body.name ?? 'Test' });
    return res;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    usersRepo = app.get<Repository<User>>(getRepositoryToken(User));

    const ensureUser = async (data: { email: string; password: string }, role: UserRole) => {
      const existing = await usersRepo.findOne({ where: { email: data.email } });
      if (existing) return existing;
      if (role === UserRole.ADMIN) {
        return usersRepo.save(
          usersRepo.create({
            email: data.email,
            name: 'Admin',
            passwordHash: await bcrypt.hash(data.password, 10),
            role,
          }),
        );
      }
      const res = await register(data);
      if (res.status !== 201) throw new Error(`No se pudo crear ${data.email}: ${res.status}`);
      return res.body.user as User;
    };

    await ensureUser(ADMIN, UserRole.ADMIN);
    await ensureUser(ENT, UserRole.ENTREPRENEUR);
    await ensureUser(OTHER, UserRole.BUYER);

    adminToken = (await (await request(app.getHttpServer()).post('/auth/login').send(ADMIN)).body).accessToken;
    entToken = (await (await request(app.getHttpServer()).post('/auth/login').send(ENT)).body).accessToken;
    otherToken = (await (await request(app.getHttpServer()).post('/auth/login').send(OTHER)).body).accessToken;
  });

  it('rechaza auto-registro con rol admin', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'hacker-e2e@mc.local', password: 'Password1', name: 'X', role: 'admin' })
      .expect(400);
  });

  it('flujo completo: solicitud -> rechazo -> reenvio -> aprobacion -> directorio -> suspension -> auditoria', async () => {
    const submit = await request(app.getHttpServer())
      .post('/entrepreneurs')
      .set('Authorization', `Bearer ${entToken}`)
      .send(sample('Artesanias Lucia'));
    expect(submit.status).toBe(201);
    expect(submit.body.status).toBe('pendiente');
    expect(submit.body.slug).toMatch(/^artesanias-lucia(-\d+)?$/);
    const slug = submit.body.slug as string;
    const id = submit.body.id as string;

    // Directorio paginado: envelope estandar
    const dirBefore = await request(app.getHttpServer()).get('/entrepreneurs/public?page=1&limit=10');
    expect(dirBefore.status).toBe(200);
    expect(dirBefore.body).toHaveProperty('items');
    expect(dirBefore.body).toHaveProperty('total');
    expect(dirBefore.body.items.map((e: Entrepreneur) => e.slug)).not.toContain(slug);

    // Otro usuario no puede verla ni editarla
    await request(app.getHttpServer())
      .get(`/entrepreneurs/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/entrepreneurs/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ description: 'defacement' + 'x'.repeat(25) })
      .expect(403);

    // Rechazo sin motivo = 400
    await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    const rejected = await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Falta informacion de contacto' });
    expect(rejected.status).toBe(201);
    expect(rejected.body.status).toBe('rechazado');
    expect(rejected.body.reviewNote).toBe('Falta informacion de contacto');

    // El dueño ve el motivo en su listado paginado y reenvia
    const mine = await request(app.getHttpServer())
      .get('/entrepreneurs/mine?page=1&limit=20')
      .set('Authorization', `Bearer ${entToken}`);
    expect(mine.body).toHaveProperty('items');
    const mineList = mine.body.items as Entrepreneur[];
    const mineEntry = mineList.find((e) => e.id === id);
    expect(mineEntry).toBeDefined();
    expect(mineEntry!.status).toBe('rechazado');
    expect(mineEntry!.reviewNote).toBe('Falta informacion de contacto');

    // Reenvio: auditoria registra el ping a pendiente
    const resub = await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/resubmit`)
      .set('Authorization', `Bearer ${entToken}`);
    expect(resub.body.status).toBe('pendiente');

    // No-admin no aprueba
    await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/approve`)
      .set('Authorization', `Bearer ${entToken}`)
      .send({})
      .expect(403);

    const approved = await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Bienvenido' });
    expect(approved.body.status).toBe('aprobado');

    const dir = await request(app.getHttpServer()).get('/entrepreneurs/public?limit=50');
    expect(dir.body.items.map((e: Entrepreneur) => e.slug)).toContain(slug);
    const bySlug = await request(app.getHttpServer()).get(`/entrepreneurs/public/${slug}`);
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.name).toBe('Artesanias Lucia');

    const suspended = await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Incumplimiento de normas' });
    expect(suspended.body.status).toBe('suspendido');
    await request(app.getHttpServer()).get(`/entrepreneurs/public/${slug}`).expect(404);

    // AUDITORIA: el historial incluye pendiente->rechazado->pendiente->aprobado->suspendido
    const hist = await request(app.getHttpServer())
      .get(`/entrepreneurs/${id}/history`)
      .set('Authorization', `Bearer ${entToken}`);
    expect(hist.status).toBe(200);
    const statuses = (hist.body as Array<{ toStatus: string }>).map((l) => l.toStatus);
    expect(statuses).toEqual(['pendiente', 'rechazado', 'pendiente', 'aprobado', 'suspendido']);

    // Otro usuario no consulta este historial
    await request(app.getHttpServer())
      .get(`/entrepreneurs/${id}/history`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('panel admin lista pendientes paginado con filtro por estado', async () => {
    const submit = await request(app.getHttpServer())
      .post('/entrepreneurs')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(sample('Cafe del Valle'));
    expect(submit.status).toBe(201);

    const pendientes = await request(app.getHttpServer())
      .get('/entrepreneurs/admin/review?status=pendiente&page=1&limit=50')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pendientes.status).toBe(200);
    expect(pendientes.body).toHaveProperty('items');
    expect((pendientes.body.items as Entrepreneur[]).every((e) => e.status === 'pendiente')).toBe(true);

    await request(app.getHttpServer())
      .get('/entrepreneurs/admin/review')
      .set('Authorization', `Bearer ${entToken}`)
      .expect(403);
  });

  it('busqueda q y filtro por categoria en el directorio', async () => {
    // Crea y aprueba una ficha con otra categoria para probar los filtros
    const sub = await request(app.getHttpServer())
      .post('/entrepreneurs')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: 'Farmacia Verde e2e',
        description: 'Herboristeria natural con infusiones de hierbas medicinales.',
        category: 'herboristeria',
      });
    const id = sub.body.id as string;
    const slugF = sub.body.slug as string;
    await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const search = await request(app.getHttpServer()).get('/entrepreneurs/public?q=herboristeria&limit=50');
    expect(search.body.items.map((e: Entrepreneur) => e.slug)).toContain(slugF);

    const byCat = await request(app.getHttpServer()).get('/entrepreneurs/public?categoria=HERBORISTERIA&limit=50');
    expect(byCat.body.items.map((e: Entrepreneur) => e.slug)).toContain(slugF);

    // Busqueda que no aplica: no devuelve esa ficha
    const noMatch = await request(app.getHttpServer()).get('/entrepreneurs/public?q=zzz-inexistente&limit=50');
    expect(noMatch.body.items.map((e: Entrepreneur) => e.slug)).not.toContain(slugF);
  });

  it('soft-delete: admin archiva, no aparece y restaurar lo recupera', async () => {
    const sub = await request(app.getHttpServer())
      .post('/entrepreneurs')
      .set('Authorization', `Bearer ${entToken}`)
      .send(sample('Decoraciones Ana'));
    const id = sub.body.id as string;
    await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // No-admin no puede archivar
    await request(app.getHttpServer())
      .delete(`/entrepreneurs/${id}`)
      .set('Authorization', `Bearer ${entToken}`)
      .expect(403);

    // Admin archiva: 204
    const del = await request(app.getHttpServer())
      .delete(`/entrepreneurs/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    // Ya no aparece en el directorio ni en mine visible-list (soft-deleted excluido)
    const dir = await request(app.getHttpServer()).get('/entrepreneurs/public?limit=50');
    expect(dir.body.items.map((e: Entrepreneur) => e.id)).not.toContain(id);

    // Aparece en la bandeja de archivados (admin)
    const archived = await request(app.getHttpServer())
      .get('/entrepreneurs/admin/archived?limit=50')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(archived.status).toBe(200);
    expect((archived.body.items as Entrepreneur[]).map((e) => e.id)).toContain(id);

    // Restaurar y volver al directorio
    const restore = await request(app.getHttpServer())
      .post(`/entrepreneurs/${id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restore.status).toBe(201);
    const dir2 = await request(app.getHttpServer()).get('/entrepreneurs/public?limit=50');
    expect(dir2.body.items.map((e: Entrepreneur) => e.id)).toContain(id);

    // Historial registra el archivo y la restauracion
    const hist = await request(app.getHttpServer())
      .get(`/entrepreneurs/${id}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    const notes = (hist.body as Array<{ note?: string }>).map((l) => l.note);
    expect(notes).toContain('Ficha archivada');
    expect(notes).toContain('Ficha restaurada');
  });

  afterAll(async () => {
    await app.close();
  });
});
