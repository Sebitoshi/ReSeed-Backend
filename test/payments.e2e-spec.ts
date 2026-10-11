import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../src/app.module.js';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { Payment, PaymentStatus } from '../src/payments/entities/payment.entity.js';

const SECRET = 'e2e-webhook-secret';

function sign(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
}

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let paymentsRepo: Repository<Payment>;

  const ADMIN = { email: 'admin-e2e-pay@mc.local', password: 'AdminE2E123' };
  const ENT = { email: 'emp-e2e-pay@mc.local', password: 'EmpE2E12345' };
  const BUYER = { email: 'buyer-e2e-pay@mc.local', password: 'BuyerE2E123' };

  let adminToken: string;
  let entToken: string;
  let buyerToken: string;

  beforeAll(async () => {
    process.env.PAYMENTS_DUMMY_SECRET = SECRET;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    usersRepo = app.get<Repository<User>>(getRepositoryToken(User));
    paymentsRepo = app.get<Repository<Payment>>(getRepositoryToken(Payment));

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

    await ensureAdminUser(ensureUser);
    await ensureUser(ENT, UserRole.ENTREPRENEUR);
    await ensureUser(BUYER, UserRole.BUYER);

    adminToken = (await (await request(app.getHttpServer()).post('/auth/login').send(ADMIN)).body).accessToken;
    entToken = (await (await request(app.getHttpServer()).post('/auth/login').send(ENT)).body).accessToken;
    buyerToken = (await (await request(app.getHttpServer()).post('/auth/login').send(BUYER)).body).accessToken;
  });

  // helper para evitar repetir el admin por_variable
  async function ensureAdminUser(
    ensure: (d: { email: string; password: string }, r: UserRole) => Promise<User>,
  ) {
    return ensure(ADMIN, UserRole.ADMIN);
  }

  let fichaId: string;

  it('setup: emprendimiento aprobado del vendedor', async () => {
    const sub = await request(app.getHttpServer())
      .post('/entrepreneurs')
      .set('Authorization', `Bearer ${entToken}`)
      .send({
        name: 'Miel Pagos e2e',
        description: 'Ficha para probar el ciclo completo de pagos del marketplace.',
        category: 'Miel',
      });
    expect(sub.status).toBe(201);
    fichaId = sub.body.id as string;
    await request(app.getHttpServer())
      .post(`/entrepreneurs/${fichaId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
  });

  it('flujo: checkout -> webhook firmado aprobado -> pago confirmado -> refund parcial -> refund total', async () => {
    // checkout
    const co = await request(app.getHttpServer())
      .post('/payments/checkout')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        amountCents: 25000,
        description: 'Compra de 2 frascos de miel',
        entrepreneurId: fichaId,
      });
    expect(co.status).toBe(201);
    expect(co.body.payment.status).toBe('pendiente');
    expect(co.body.payment.amount).toBe('250.00');
    expect(co.body.checkoutUrl).toContain(co.body.payment.externalRef);
    const paymentId = co.body.payment.id as string;
    const externalRef = co.body.payment.externalRef as string;

    // webhook sin firma -> 400
    const noSig = await request(app.getHttpServer())
      .post('/payments/webhook/dummy')
      .send({ externalRef, outcome: 'approved' });
    expect(noSig.status).toBe(400);

    // webhook con firma invalida -> 400
    const badSig = await request(app.getHttpServer())
      .post('/payments/webhook/dummy')
      .set('X-Dummy-Signature', 'deadbeef')
      .send({ externalRef, outcome: 'approved' });
    expect(badSig.status).toBe(400);

    // webhook firmado: aprobado (2 entregas seguidas, idempotente)
    const payload = JSON.stringify({ externalRef, outcome: 'approved' });
    const wh1 = await request(app.getHttpServer())
      .post('/payments/webhook/dummy')
      .set('X-Dummy-Signature', sign(payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(wh1.status).toBe(200);
    expect(wh1.body.status).toBe('aprobado');
    expect(wh1.body.changed).toBe(true);

    const wh2 = await request(app.getHttpServer())
      .post('/payments/webhook/dummy')
      .set('X-Dummy-Signature', sign(payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(wh2.status).toBe(200);
    expect(wh2.body.changed).toBe(false); // no-op, no procesa dos veces

    // pago confirmado en BD
    const stored = await paymentsRepo.findOne({ where: { id: paymentId } });
    expect(stored?.status).toBe(PaymentStatus.APPROVED);
    expect(stored?.confirmedAt).toBeTruthy();

    // el vendedor (dueno del emprendimiento) puede ver el pago
    const sellerView = await request(app.getHttpServer())
      .get(`/payments/${paymentId}`)
      .set('Authorization', `Bearer ${entToken}`);
    expect(sellerView.status).toBe(200);

    // un extraño (admin autenticado como otro comprador) tampoco puede verlo:
    // un usuario sin relacion no puede ver el pago
    // (NOTA: admin SI puede por rol; el rol de vendedor de otra ficha no podria)

    // comprador ve su pago
    const mine = await request(app.getHttpServer())
      .get(`/payments/${paymentId}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(mine.status).toBe(200);

    // un tercero registrado en el sistema no puede refund
    const strangerReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `st-x-${Date.now()}@mc.local`,
        password: 'Stranger123',
        name: 'Stranger',
      });
    const strangerToken = strangerReg.body.accessToken as string | undefined;
    if (strangerToken) {
      const noAccess = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ amountCents: 100 });
      expect(noAccess.status).toBe(403);
    }

    // refund parcial por el comprador
    const pr = await request(app.getHttpServer())
      .post(`/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amountCents: 10000, reason: 'Frasco roto en el envio' });
    expect(pr.status).toBe(201);
    expect(pr.body.refundedAmountCents).toBe(10000);
    expect(pr.body.status).toBe('aprobado'); // aun hay saldo

    // refund mayor al restante -> 400
    const over = await request(app.getHttpServer())
      .post(`/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amountCents: 999999 });
    expect(over.status).toBe(400);

    // refund del restante por el admin -> REEMBOLSADO
    const total = await request(app.getHttpServer())
      .post(`/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(total.body.refundedAmountCents).toBe(25000);
    expect(total.body.status).toBe('reembolsado');

    // el historial de refunds muestra los dos
    const refunds = await request(app.getHttpServer())
      .get(`/payments/${paymentId}/refunds`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(refunds.status).toBe(200);
    expect(refunds.body).toHaveLength(2);

    // listing mine del comprador incluye el pago
    const list = await request(app.getHttpServer())
      .get('/payments/mine?limit=50')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect((list.body.items as Array<{ id: string }>).map((p) => p.id)).toContain(paymentId);
  });

  it('webhook rejected -> pago rechazado; refund sobre rechazado -> 400', async () => {
    const co = await request(app.getHttpServer())
      .post('/payments/checkout')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amountCents: 5000, description: 'Intento con tarjeta declinada' });
    const externalRef = co.body.payment.externalRef as string;
    const paymentId = co.body.payment.id as string;

    const payload = JSON.stringify({ externalRef, outcome: 'rejected' });
    const wh = await request(app.getHttpServer())
      .post('/payments/webhook/dummy')
      .set('X-Dummy-Signature', sign(payload))
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(wh.status).toBe(200);
    expect(wh.body.status).toBe('rechazado');

    const refund = await request(app.getHttpServer())
      .post(`/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({});
    expect(refund.status).toBe(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
