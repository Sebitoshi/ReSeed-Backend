import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntrepreneursService } from './entrepreneurs.service.js';
import { Entrepreneur, EntrepreneurStatus } from './entities/entrepreneur.entity.js';
import { EntrepreneurStatusLogService } from './entrepreneur-status-log.service.js';
import { UsersService } from '../users/users.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';

const user = (role: string, userId = 'u1'): AuthUser => ({
  userId,
  email: `${userId}@t.com`,
  role,
});

type Row = Partial<Entrepreneur> & { id: string };

/**
 * Query builder mock que interpreta las condiciones SQL concretas que usa
 * EntrepreneursService (ownerId, status, categoria, q, deletedAt).
 */
function buildQb(store: Row[]) {
  let conds: Array<(e: Row) => boolean> = [];
  let includeDeleted = false;
  let skip = 0;
  let take = Infinity;

  const andWhere = (sql: string, b: Record<string, unknown> = {}) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.includes('e.ownerId = :ownerId')) conds.push((e) => e.ownerId === b.ownerId);
    else if (s.includes('e.status = :status')) conds.push((e) => e.status === b.status);
    else if (s.includes('LOWER(e.category) = LOWER(:categoria)'))
      conds.push((e) => (e.category ?? '').toLowerCase() === String(b.categoria).toLowerCase());
    else if (s.includes('LIKE :term')) {
      const term = String(b.term);
      const needle = term.replace(/^%|%$/g, '');
      conds.push(
        (e) =>
          e.name?.toLowerCase().includes(needle) ||
          e.description?.toLowerCase().includes(needle),
      );
    } else if (s.includes('e.deletedAt IS NOT NULL'))
      conds.push((e) => e.deletedAt != null);
    else if (s.includes('e.isSystem = false'))
      conds.push((e) => e.isSystem !== true);
    else throw new Error(`Mock no soporta condicion: ${s}`);
    return qb;
  };

  const qb = {
    where: vi.fn(andWhere),
    andWhere: vi.fn(andWhere),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn((n: number) => {
      take = n;
      return qb;
    }),
    skip: vi.fn((n: number) => {
      skip = n;
      return qb;
    }),
    withDeleted: vi.fn(() => {
      includeDeleted = true;
      return qb;
    }),
    leftJoin: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(async () => {
      const pool = store.filter((e) => includeDeleted || !e.deletedAt);
      const filtered = pool.filter((e) => conds.every((c) => c(e)));
      return [filtered.slice(skip, skip + take), filtered.length];
    }),
  };
  return qb;
}

function makeRepoMock() {
  const store: Row[] = [];
  return {
    store,
    create: vi.fn((data: Partial<Entrepreneur>) =>
      ({ id: 'e-' + (store.length + 1), ...data }) as Row,
    ),
    save: vi.fn(async (e: Row) => {
      const i = store.findIndex((x) => x.id === e.id);
      if (i >= 0) store[i] = { ...store[i], ...e };
      else store.push(e);
      return e as Entrepreneur;
    }),
    findOne: vi.fn(
      async ({ where, withDeleted }: { where: { id?: string; slug?: string }; withDeleted?: boolean }) =>
        store.find(
          (e) =>
            (!where.id || e.id === where.id) &&
            (!where.slug || e.slug === where.slug) &&
            (withDeleted || !e.deletedAt),
        ) ?? null,
    ),
    exists: vi.fn(async ({ where }: { where: { slug: string } }) =>
      store.some((e) => e.slug === where.slug && !e.deletedAt),
    ),
    softRemove: vi.fn(async (e: Row) => {
      e.deletedAt = new Date();
      return e as Entrepreneur;
    }),
    recover: vi.fn(async (e: Row) => {
      e.deletedAt = null;
      return e as Entrepreneur;
    }),
    createQueryBuilder: vi.fn(() => buildQb(store)),
  };
}

function makeLogMock() {
  return {
    record: vi.fn(async () => undefined),
    history: vi.fn(async () => []),
  };
}

describe('EntrepreneursService (unit)', () => {
  let service: EntrepreneursService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: any;
  let log: ReturnType<typeof makeLogMock>;

  beforeEach(async () => {
    repo = makeRepoMock();
    log = makeLogMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EntrepreneursService,
        { provide: getRepositoryToken(Entrepreneur), useValue: repo },
        { provide: EntrepreneurStatusLogService, useValue: log },
        { provide: UsersService, useValue: { findById: vi.fn(async () => null) } },
        { provide: NotificationsService, useValue: { notifyUser: vi.fn(async () => null) } },
      ],
    }).compile();
    service = moduleRef.get(EntrepreneursService);
  });

  it('submit crea con estado pendiente, slug unico y registra en auditoria', async () => {
    const res = await service.submit(user('emprendedor'), {
      name: 'Miel Dorada',
      description: 'Miel pura de apicultores locales de pequeñas granjas.',
    });
    expect(res.status).toBe(EntrepreneurStatus.PENDING);
    expect(res.slug).toBe('miel-dorada');
    expect(log.record).toHaveBeenCalledWith(
      res.id,
      EntrepreneurStatus.PENDING,
      { id: 'u1', role: 'emprendedor' },
    );
  });

  it('submit genera slug con sufijo si ya existe', async () => {
    const a = await service.submit(user('emprendedor'), {
      name: 'Miel Dorada',
      description: 'Miel pura de apicultores locales de pequeñas granjas.',
    });
    const b = await service.submit(user('emprendedor'), {
      name: 'Miel Dorada',
      description: 'Segunda solicitud con la misma marca de miel regional.',
    });
    expect(a.slug).toBe('miel-dorada');
    expect(b.slug).toBe('miel-dorada-2');
  });

  it('slugify quita acentos y caracteres raros', async () => {
    const res = await service.submit(user('emprendedor'), {
      name: 'Café Ñandú & Cía!!',
      description: 'Cafeteria artesanal de barrio con granos de origen local.',
    });
    expect(res.slug).toBe('cafe-nandu-cia');
  });

  it('viewAs rechaza a quien no es dueño (403) y admin puede ver', async () => {
    const e = await service.submit(user('emprendedor'), {
      name: 'Velarte Textil',
      description: 'Telares artesanales hechos a mano por comunidades andinas.',
    });
    await expect(service.viewAs(e.id, user('comprador', 'u2'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.viewAs(e.id, user('admin', 'adm1'))).resolves.toBeDefined();
  });

  it('reject exige motivo y no permite rechazar un aprobado', async () => {
    const e = await service.submit(user('emprendedor'), {
      name: 'Dulce Sur',
      description: 'Reposteria tradicional del sur con recetas familiares.',
    });
    await expect(
      service.reject(e.id, user('admin', 'adm1'), { note: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.approve(e.id, user('admin', 'adm1'), {});
    await expect(
      service.reject(e.id, user('admin', 'adm1'), { note: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resubmit solo desde rechazado/suspendido', async () => {
    const e = await service.submit(user('emprendedor'), {
      name: 'Humo y Leña',
      description: 'Chorizos y ahumados artesanales de la sierra.',
    });
    await expect(service.resubmit(e.id, user('emprendedor'))).rejects.toBeInstanceOf(BadRequestException);
    await service.suspend(e.id, user('admin', 'adm1'), { note: 'docs' });
    const res = await service.resubmit(e.id, user('emprendedor'));
    expect(res.status).toBe(EntrepreneurStatus.PENDING);
  });

  it('remove hace soft-delete, saca del directorio y restore recupera', async () => {
    const e = await service.submit(user('emprendedor'), {
      name: 'Ceramica Roja',
      description: 'Piezas de barro cocido hechas a mano en el pueblo.',
    });
    await service.approve(e.id, user('admin', 'adm1'), {});
    await service.remove(e.id, user('admin', 'adm1'));
    const saved = repo.store.find((x: Row) => x.id === e.id);
    expect(saved?.deletedAt).toBeTruthy();
    await expect(service.findApprovedBySlug('ceramica-roja')).rejects.toBeInstanceOf(NotFoundException);

    await service.restore(e.id, user('admin', 'adm1'));
    const restored = repo.store.find((x: Row) => x.id === e.id);
    expect(restored?.deletedAt ?? null).toBeFalsy();
    // Sigue no aprobado -> publico 404, pero la ficha existe para el dueño
    await expect(service.viewAs(e.id, user('emprendedor'))).resolves.toBeDefined();
  });

  it('findApproved filtra por categoria (case-insensitive) y busqueda q', async () => {
    await service.approve(
      (
        await service.submit(user('emprendedor'), {
          name: 'Miel Roja',
          description: 'Miel de flor de lagar con tono ambar profundo.',
          category: 'COSMETICA',
        })
      ).id,
      user('admin', 'adm1'),
      {},
    );
    await service.approve(
      (
        await service.submit(user('emprendedor'), {
          name: 'Tela Ruda',
          description: 'Mantas de lana tejidas en telar de madera.',
          category: 'textil',
        })
      ).id,
      user('admin', 'adm1'),
      {},
    );

    const byCategoria = await service.findApproved({ categoria: 'cosmetica', page: 1, limit: 10 });
    expect(byCategoria.items.map((e) => e.name)).toEqual(['Miel Roja']);

    const byQ = await service.findApproved({ q: 'miel', page: 1, limit: 10 });
    expect(byQ.items.map((e) => e.name)).toContain('Miel Roja');
    expect(byQ.items.map((e) => e.name)).not.toContain('Tela Ruda');
  });

  it('listMine pagina con envelope estandar', async () => {
    for (const name of ['A Uno', 'B Dos', 'C Tres']) {
      await service.submit(user('emprendedor'), {
        name,
        description: 'Descripcion suficientemente larga para pasar la validacion.',
      });
    }
    const res = await service.listMine('u1', { page: 1, limit: 2 });
    expect(res.items).toHaveLength(2);
    expect(res.total).toBe(3);
    expect(res.totalPages).toBe(2);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(2);
  });

  it('listMine excluye fichas de otros usuarios', async () => {
    await service.submit(user('emprendedor'), {
      name: 'Solo mio',
      description: 'Descripcion suficientemente larga para pasar la validacion.',
    });
    await service.submit(user('emprendedor', 'u2'), {
      name: 'De U2',
      description: 'Otra descripcion suficientemente larga para el modelo.',
    });
    const res = await service.listMine('u1', { page: 1, limit: 10 });
    expect(res.items.map((e) => e.name)).toEqual(['Solo mio']);
  });
});
