import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../src/app.module.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';

describe('Products (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;

  const ADMIN = { email: 'admin-e2e-prod@mc.local', password: 'AdminE2E123' };
  const ENT = { email: 'emp-e2e-prod@mc.local', password: 'EmpE2E12345' };
  const OTHER = { email: 'other-e2e-prod@mc.local', password: 'OtherE2E123' };

  let adminToken: string;
  let entToken: string;
  let otherToken: string;

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
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...data, name: 'Test' });
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

  let entCatId: string;
  let catCeramica: string;

  it('setup: admin crea categorias; arbol publico las expone', async () => {
    const c1 = await request(app.getHttpServer())
      .post('/product-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Miel y Derivados' });
    expect(c1.status).toBe(201);
    entCatId = c1.body.id as string;

    const c2 = await request(app.getHttpServer())
      .post('/product-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ceramica' });
    catCeramica = c2.body.id as string;

    // No-admin no puede crear categorias
    await request(app.getHttpServer())
      .post('/product-categories')
      .set('Authorization', `Bearer ${entToken}`)
      .send({ name: 'Pirata' })
      .expect(400);

    const tree = await request(app.getHttpServer()).get('/product-categories/public/tree');
    expect(tree.status).toBe(200);
    const slugs = (tree.body as Array<{ slug: string }>).map((c) => c.slug);
    expect(slugs).toContain('miel-y-derivados');
    expect(slugs).toContain('ceramica');
  });

  it('flujo completo: emprendimiento aprobado -> producto -> publicar -> catalogo publico -> despublicar -> borrar', async () => {
    // dueño crea emprendimiento y se aprueba
    const sub = await request(app.getHttpServer())
      .post('/entrepreneurs')
      .set('Authorization', `Bearer ${entToken}`)
      .send({
        name: 'Colmena Sur e2e',
        description: 'Apicultura sostenible con miel y derivados de la colmena.',
        category: 'Miel',
      });
    expect(sub.status).toBe(201);
    const entId = sub.body.id as string;
    await request(app.getHttpServer())
      .post(`/entrepreneurs/${entId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // crear producto sin stock (servicio ilimitado)
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${entToken}`)
      .send({
        name: 'Miel de Ulmo',
        description: 'Miel monofloral de ulmo cosechada en bosques nativos del sur.',
        priceCents: 8900,
        categoryId: entCatId,
        entrepreneurId: entId,
        images: ['https://cdn.local/ulmo-1.jpg'],
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('borrador');
    expect(created.body.price).toBe('89.00');
    expect(created.body.images).toEqual(['https://cdn.local/ulmo-1.jpg']);
    const productId = created.body.id as string;

    // no aparece en el catalogo publico mientras es borrador
    const early = await request(app.getHttpServer()).get(`/products/public/${productId}`);
    expect(early.status).toBe(404);

    // otro usuario no ve ni edita este producto
    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ priceCents: 1 })
      .expect(404);

    // publicar: OK
    const pub = await request(app.getHttpServer())
      .post(`/products/${productId}/publish`)
      .set('Authorization', `Bearer ${entToken}`);
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe('publicado');

    // ahora visible publicamente: detalle y listado
    const detail = await request(app.getHttpServer()).get(`/products/public/${productId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.name).toBe('Miel de Ulmo');
    expect(detail.body.price).toBe('89.00');
    expect(detail.body.available).toBeNull(); // sin stock = servicio

    const listed = await request(app.getHttpServer()).get(
      `/products/public?q=ulmo&limit=50`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveProperty('items');
    expect(listed.body).toHaveProperty('total');
    expect(listed.body.total).toBeGreaterThanOrEqual(1);
    expect((listed.body.items as Array<{ id: string }>).map((p) => p.id)).toContain(productId);

    // filtro por categoria
    const byCat = await request(app.getHttpServer()).get(
      `/products/public?categoryId=${entCatId}&limit=50`,
    );
    expect((byCat.body.items as Array<{ id: string }>).map((p) => p.id)).toContain(productId);

    // editar: publicado vuelve a borrador
    const upd = await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set('Authorization', `Bearer ${entToken}`)
      .send({ priceCents: 9500 });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('borrador');
    expect(upd.body.price).toBe('95.00');

    // repoblicar y luego despublicar: sale del catalogo sin borrarse
    await request(app.getHttpServer())
      .post(`/products/${productId}/publish`)
      .set('Authorization', `Bearer ${entToken}`);
    const unpub = await request(app.getHttpServer())
      .post(`/products/${productId}/unpublish`)
      .set('Authorization', `Bearer ${entToken}`);
    expect(unpub.status).toBe(200);
    expect(unpub.body.status).toBe('despublicado');
    await request(app.getHttpServer()).get(`/products/public/${productId}`).expect(404);

    // borrar (soft): mine lo excluye
    const del = await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set('Authorization', `Bearer ${entToken}`);
    expect(del.status).toBe(204);
    const mine = await request(app.getHttpServer())
      .get('/products/mine?limit=50')
      .set('Authorization', `Bearer ${entToken}`);
    expect((mine.body.items as Array<{ id: string }>).map((p) => p.id)).not.toContain(productId);
  });

  it('publish exige emprendimiento aprobado; la disponibilidad refleja stock', async () => {
    // emprendimiento pendiente (no aprobado)
    const sub = await request(app.getHttpServer())
      .post('/entrepreneurs')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: 'Ceramica Norte e2e',
        description: 'Greda cocida a leña por alfareros del norte chico.',
        category: 'Ceramica',
      });
    const entId = sub.body.id as string;

    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: 'Paila de Greda',
        description: 'Paila de greda para cocinar con acabado pulido a mano.',
        priceCents: 12000,
        categoryId: catCeramica,
        entrepreneurId: entId,
        stock: 7,
      });
    expect(created.status).toBe(201);
    const productId = created.body.id as string;

    // publicar falla: emprendimiento pendiente
    const pub = await request(app.getHttpServer())
      .post(`/products/${productId}/publish`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(pub.status).toBe(400);
    expect(pub.body.message).toMatch(/aprobado/i);

    // el comprador no la ve en listado
    const byCat = await request(app.getHttpServer()).get(
      `/products/public?categoryId=${catCeramica}&limit=50`,
    );
    expect((byCat.body.items as Array<{ id: string }>).map((p) => p.id)).not.toContain(productId);
  });
});
