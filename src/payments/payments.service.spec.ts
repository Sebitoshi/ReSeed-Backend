import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { Payment, PaymentStatus } from './entities/payment.entity.js';
import { Refund } from './entities/refund.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import type { GatewayProvider } from './gateway/payment-gateway.interface.js';
import { PAYMENTS_GATEWAY } from './payments.constants.js';

import type { AuthUser } from '../users/decorators/current-user.decorator.js';

const user = (role: string, userId = 'u1'): AuthUser => ({
  userId,
  email: `${userId}@t.com`,
  role,
});

type PRow = Partial<Payment> & {
  id: string;
  externalRef: string;
  amountCents: number;
  netAmountCents: number;
  refundedAmountCents: number;
  status: PaymentStatus;
};

function makePaymentsRepo(store: PRow[]) {
  return {
    store,
    create: vi.fn((data: Partial<Payment>) => data as PRow),
    save: vi.fn(async (e: Partial<Payment> & { id?: string }) => {
      const row = { id: e.id ?? 'pay-' + (store.length + 1), ...e } as PRow;
      const i = store.findIndex((x) => x.id === row.id);
      if (i >= 0) store[i] = { ...store[i], ...row };
      else store.push(row);
      return row as Payment;
    }),
    findOne: vi.fn(async ({ where }: { where: { externalRef?: string; id?: string } }) => {
      return (
        store.find(
          (p) =>
            (!where.externalRef || p.externalRef === where.externalRef) &&
            (!where.id || p.id === where.id),
        ) ?? null
      );
    }),
    createQueryBuilder: vi.fn(() => {
      throw new Error('qb no usado en unit');
    }),
  };
}

function makeRefundsRepo(store: Array<Partial<Refund> & { externalRef: string }>) {
  return {
    store,
    create: vi.fn((data: Partial<Refund>) => data as Refund),
    save: vi.fn(async (e: Refund) => {
      if (!e.externalRef) throw new Error('refund sin externalRef');
      store.push(e as Refund & { externalRef: e.externalRef });
      return e;
    }),
    findOne: vi.fn(async ({ where }: { where: { externalRef?: string; paymentId?: string } }) => {
      return (
        store.find(
          (r) =>
            (!where.externalRef || r.externalRef === where.externalRef) &&
            (!where.paymentId || r.paymentId === where.paymentId),
        ) ?? null
      );
    }),
    find: vi.fn(async ({ where }: { where: { paymentId: string } }) =>
      store.filter((r) => r.paymentId === where.paymentId) as Refund[],
    ),
  };
}

function makeEntsRepo(store: Array<Partial<Entrepreneur> & { id: string }>) {
  return {
    findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
      store.find((e) => e.id === where.id) as Entrepreneur | null,
    ),
  };
}

const gwStub: GatewayProvider = {
  name: 'dummy',
  createCheckout: vi.fn(async (input) => ({
    checkoutUrl: `https://sandbox.test/${input.externalRef}`,
    externalRef: input.externalRef,
  })),
  parseAndVerifyWebhook: vi.fn(),
  createRefund: vi.fn(async (ref, amount) => ({ refundExternalRef: `rfnd-${ref}-${amount}` })),
};

describe('PaymentsService (unit)', () => {
  let service: PaymentsService;
  let paymentsRepo: ReturnType<typeof makePaymentsRepo>;
  let refundsRepo: ReturnType<typeof makeRefundsRepo>;
  const ents = [
    { id: 'e1', ownerId: 'u1' },
    { id: 'e2', ownerId: 'u2' },
  ];
  const gwRef: GatewayProvider = gwStub;

  beforeEach(async () => {
    paymentsRepo = makePaymentsRepo([]);
    refundsRepo = makeRefundsRepo([]);
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Refund), useValue: refundsRepo },
        { provide: getRepositoryToken(Entrepreneur), useValue: makeEntsRepo(ents) },
        { provide: PAYMENTS_GATEWAY, useValue: gwRef },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  it('checkout crea pago pendiente en COP con URL de la pasarela', async () => {
    const res = await service.createCheckout(user('comprador'), {
      amountCents: 50000,
      description: 'Compra de taza',
      entrepreneurId: 'e1',
    });
    expect(res.payment.status).toBe(PaymentStatus.PENDING);
    expect(res.payment.currencyCode).toBe('COP');
    expect(res.payment.amount).toBe('500.00');
    expect(res.checkoutUrl).toContain(res.payment.externalRef);
  });

  it('checkout hacia emprendimiento inexistente -> 404', async () => {
    await expect(
      service.createCheckout(user('comprador'), {
        amountCents: 1000,
        entrepreneurId: 'no-existe',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checkout: un comprador puede pagar a un emprendimiento ajeno (marketplace)', async () => {
    const res = await service.createCheckout(
      { ...user('comprador'), userId: 'other' },
      { amountCents: 1000, entrepreneurId: 'e1' },
    );
    expect(res.payment.status).toBe(PaymentStatus.PENDING);
  });

  it('checkout conmonto no positivo -> 400', async () => {
    await expect(
      service.createCheckout(user('comprador'), { amountCents: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('webhook approved: confirma y luego es no-op idempotente', async () => {
    const { payment } = await service.createCheckout(user('comprador'), { amountCents: 2000 });
    const ref = payment.externalRef;
    const first = await service.processWebhookEvent({ externalRef: ref, outcome: 'approved' });
    expect(first).toEqual({ paymentId: payment.id, status: PaymentStatus.APPROVED, changed: true });
    // Doble entrega del mismo evento: no cambia nada
    const second = await service.processWebhookEvent({ externalRef: ref, outcome: 'approved' });
    expect(second.changed).toBe(false);
  });

  it('webhook approved con monto distinto -> 400 (conciliacion)', async () => {
    const { payment } = await service.createCheckout(user('comprador'), { amountCents: 2000 });
    await expect(
      service.processWebhookEvent({ externalRef: payment.externalRef, outcome: 'approved', amountCents: 999 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transicion invalida: approved sobre rechazado -> 409', async () => {
    const { payment } = await service.createCheckout(user('comprador'), { amountCents: 1000 });
    await service.processWebhookEvent({ externalRef: payment.externalRef, outcome: 'rejected' });
    await expect(
      service.processWebhookEvent({ externalRef: payment.externalRef, outcome: 'approved' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('webhook desconocido -> 404', async () => {
    await expect(
      service.processWebhookEvent({ externalRef: 'no-existe', outcome: 'approved' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refund: total y parcial; pagador, vendedor y admin pueden; extraño no', async () => {
    // buyer1 compra del emprendimiento e1 (dueno u1)
    const { payment } = await service.createCheckout(
      { ...user('comprador'), userId: 'buyer1' },
      {
        amountCents: 10000,
        entrepreneurId: 'e1',
      },
    );
    await service.processWebhookEvent({ externalRef: payment.externalRef, outcome: 'approved' });

    // extraño no puede refund (u2 es dueno del emprendimiento e2, no de e1)
    await expect(
      service.createRefund(payment.id, { ...user('emprendedor'), userId: 'u2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // parcial por el vendedor
    const partial = await service.createRefund(payment.id, user('emprendedor', 'u1'), {
      amountCents: 4000,
      reason: 'Producto defectuoso',
    });
    expect(partial.refundedAmountCents).toBe(4000);
    expect(partial.status).toBe(PaymentStatus.APPROVED); // no reembolsado total

    // parcial por encima del restante -> 400
    await expect(
      service.createRefund(payment.id, user('emprendedor', 'u1'), { amountCents: 7000 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // refund total por admin: queda REFUNDED
    const total = await service.createRefund(payment.id, user('admin', 'adm'));
    expect(total.refundedAmountCents).toBe(10000);
    expect(total.status).toBe(PaymentStatus.REFUNDED);

    // refund tras total -> 400 (nada pendiente)
    await expect(
      service.createRefund(payment.id, user('admin', 'adm')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refund sobre pago no aprobado -> 400', async () => {
    const { payment } = await service.createCheckout(user('comprador'), { amountCents: 5000 });
    await expect(
      service.createRefund(payment.id, user('comprador'), { amountCents: 1000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
