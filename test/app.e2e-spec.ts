import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registra un usuario y devuelve token con su rol', async () => {
    const email = `e2e-${Date.now()}@test.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Test User', role: 'emprendedor' })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('emprendedor');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rechaza registro con rol invalido', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `x-${Date.now()}@test.com`, password: 'secret123', name: 'X', role: 'hacker' })
      .expect(400);
  });

  it('rechaza email duplicado', async () => {
    const email = `dup-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Uno' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Dos' })
      .expect(409);
  });

  it('hace login con credenciales validas y rechaza invalidas', async () => {
    const email = `login-${Date.now()}@test.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Login User' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'secret123' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'incorrecta' })
      .expect(401);
  });

  it('protege /users/me con JWT y expone el perfil', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('endpoint de admin exige rol admin', async () => {
    const email = `ent-${Date.now()}@test.com`;
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'secret123', name: 'Emprendedor', role: 'emprendedor' });
    const token = register.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/auth/admin/only')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
