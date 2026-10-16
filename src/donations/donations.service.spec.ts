import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DonationsService } from './donations.service.js';
import { Donation, DonationStatus } from './entities/donation.entity.js';
import { Campaign } from '../campaigns/entities/campaign.entity.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';

const user: AuthUser = { userId: 'u1', email: 'u1@t.com', role: 'comprador' };

type Row = Partial<Donation> & { id: string };

/** Query builder flexible: cada llamada se resuelve con el resultado encolado. */
function makeQb(raw: { many?: unknown[]; one?: unknown } = {}) {
  const qb: Record<string, unknown> = {};
  const chain = () => qb;
  for (const m of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'innerJoin',
    'limit',
    'take',
    'skip',
  ]) {
    qb[m] = vi.fn(chain);
  }
  qb.getRawMany = vi.fn(async () => raw.many ?? []);
  qb.getRawOne = vi.fn(async () => raw.one ?? null);
  qb.getMany = vi.fn(async () => []);
  return qb;
}

function makeDonationsRepo() {
  const store: Row[] = [];
  const builders: unknown[] = [];
  return {
    store,
    builders,
    create: vi.fn((data: Partial<Donation>) => data as Donation),
    save: vi.fn(async (data: Partial<Donation>) => {
      const row = { id: data.id ?? `don-${store.length + 1}`, ...data } as Row;
      const i = store.findIndex((d) => d.id === row.id);
      if (i >= 0) store[i] = { ...store[i], ...row };
      else store.push(row);
      return row as Donation;
    }),
    findOne: vi.fn(async ({ where }: { where: { id?: string } }) =>
      (store.find((d) => d.id === where.id) ?? null) as Donation | null,
    ),
    findAndCount: vi.fn(async () => [store as Donation[], store.length]),
    find: vi.fn(async () => store as Donation[]),
    count: vi.fn(async () => store.length),
    createQueryBuilder: vi.fn(() => builders.shift() ?? makeQb()),
  };
}

describe('DonationsService (unit)', () => {
  let service: DonationsService;
  let donations: ReturnType<typeof makeDonationsRepo>;
  let campaignsRepo: { findOne: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn> };
  let payments: { createCheckout: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    donations = makeDonationsRepo();
    campaignsRepo = { findOne: vi.fn(async () => null), find: vi.fn(async () => []) };
    payments = {
      createCheckout: vi.fn(async () => ({
        payment: {
          id: 'pay-1',
          externalRef: 'ext-1',
          amountCents: 20000,
          currencyCode: 'COP',
          status: 'pendiente',
        },
        checkoutUrl: 'https://sandbox.test/ext-1',
      })),
    };
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: getRepositoryToken(Donation), useValue: donations },
        { provide: getRepositoryToken(Campaign), useValue: campaignsRepo },
        { provide: PaymentsService, useValue: payments },
      ],
    }).compile();
    service = moduleRef.get(DonationsService);
  });

  // ---------- Crear ----------

  it('rechaza aportes por debajo del minimo -> 400', async () => {
    await expect(service.create(user, { amountCents: 500 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sin campana el aporte va al fondo general', async () => {
    const res = await service.create(user, { amountCents: 5000 });

    expect(payments.createCheckout).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ amountCents: 5000, description: expect.stringContaining('fondo') }),
    );
    expect(donations.store[0]).toMatchObject({
      campaignId: null,
      paymentId: 'pay-1',
      amountCents: 5000,
      status: DonationStatus.PENDING,
    });
    expect(res).toMatchObject({ paymentId: 'pay-1', checkoutUrl: 'https://sandbox.test/ext-1' });
  });

  it('a una campana activa: crea el pago con la campana y guarda el aporte pendiente', async () => {
    campaignsRepo.findOne.mockResolvedValue({ id: 'c1', title: 'Semana de la Miel', status: 'activa' });

    await service.create(user, { amountCents: 20000, campaignId: 'c1', message: '  gracias  ' });

    expect(payments.createCheckout).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        description: expect.stringContaining('Semana de la Miel'),
        metadata: expect.objectContaining({ kind: 'donation', campaignId: 'c1' }),
      }),
    );
    expect(donations.store[0]).toMatchObject({
      campaignId: 'c1',
      status: DonationStatus.PENDING,
      message: 'gracias',
    });
  });

  it('campana inexistente -> 404', async () => {
    await expect(
      service.create(user, { amountCents: 20000, campaignId: 'no-existe' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('campana finalizada -> 400', async () => {
    campaignsRepo.findOne.mockResolvedValue({ id: 'c1', title: 'Vieja', status: 'finalizada' });
    await expect(
      service.create(user, { amountCents: 20000, campaignId: 'c1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ---------- Consultas ----------

  it('summary reparte totales, fondo general y avance por campana', async () => {
    donations.builders.push(
      makeQb({
        many: [
          { campaignId: null, raised: '15000', donors: '1', count: '2' },
          { campaignId: 'c1', raised: '50000', donors: '3', count: '3' },
        ],
      }),
      makeQb({ one: { raised: '65000', donors: '4', count: '5' } }),
    );
    campaignsRepo.find.mockResolvedValue([
      {
        id: 'c1',
        title: 'Miel',
        slug: 'miel',
        summary: null,
        imageUrl: null,
        goalCents: '100000',
        endsAt: null,
      },
    ]);

    const res = await service.summary();

    expect(res.totals).toEqual({ raisedCents: 65000, donors: 4, count: 5 });
    expect(res.general).toEqual({ raisedCents: 15000, donors: 1, count: 2 });
    expect(res.campaigns[0]).toMatchObject({
      id: 'c1',
      goalCents: 100000,
      raisedCents: 50000,
      donors: 3,
    });
  });

  it('adminStats resume el recaudo total, el fondo general y por campana', async () => {
    donations.builders.push(
      makeQb({
        many: [
          { status: DonationStatus.APPROVED, count: '3' },
          { status: DonationStatus.PENDING, count: '2' },
        ],
      }),
      makeQb({ one: { raised: '65000', general: '15000' } }),
      makeQb({ many: [{ campaignId: 'c1', title: 'Miel', raised: '50000', donors: '3' }] }),
    );

    const res = await service.adminStats();

    expect(res).toMatchObject({
      total: 5,
      aprobadas: 3,
      pendientes: 2,
      recaudado: '650.00',
      fondoGeneral: '150.00',
      porCampana: '500.00',
    });
    expect(res.topCampanas[0]).toMatchObject({ campaignId: 'c1', raisedCents: 50000, donors: 3 });
  });
});
