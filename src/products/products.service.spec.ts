import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import {
  Entrepreneur,
  EntrepreneurStatus,
} from '../entrepreneurs/entities/entrepreneur.entity.js';
import { Product, ProductStatus } from './entities/product.entity.js';
import { ProductCategory } from './entities/product-category.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';

const user = (role: string, userId = 'u1'): AuthUser => ({
  userId,
  email: `${userId}@t.com`,
  role,
});

type PRow = Partial<Product> & { id: string };

function buildProductQb(
  store: PRow[],
  ents: Array<Partial<Entrepreneur> & { id: string }>,
) {
  let conds: Array<(p: PRow) => boolean> = [];
  let skip = 0;
  let take = Infinity;

  const interpret = (sql: string, b: Record<string, unknown> = {}): ((p: PRow) => boolean) | null => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.includes('p.status = :published')) return (p) => p.status === b.published;
    if (s.includes('p.isActive = true')) return (p) => p.isActive === true;
    if (s.includes('e.status = :approved'))
      return (p) =>
        ents.find((e) => e.id === p.entrepreneurId)?.status === EntrepreneurStatus.APPROVED;
    if (s.includes('p.categoryId = :categoryId')) return (p) => p.categoryId === b.categoryId;
    if (s.includes('p.entrepreneurId = :entrepreneurId'))
      return (p) => p.entrepreneurId === b.entrepreneurId;
    if (s.includes('LIKE :term')) {
      const needle = String(b.term).replace(/^%|%$/g, '');
      return (p) =>
        p.name?.toLowerCase().includes(needle) || p.description?.toLowerCase().includes(needle);
    }
    if (s === '1=1') return null;
    if (s.includes('p.entrepreneurId IN (:...ownedIds)')) {
      const ids = (b.ownedIds ?? []) as string[];
      return (p) => ids.includes(p.entrepreneurId!);
    }
    throw new Error(`Mock no soporta condicion: ${s}`);
  };

  const add = (sql: string, b?: Record<string, unknown>) => {
    const c = interpret(sql, b);
    if (c) conds.push(c);
    return qb;
  };

  const qb = {
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn(add),
    andWhere: vi.fn(add),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn((n: number) => {
      take = n;
      return qb;
    }),
    skip: vi.fn((n: number) => {
      skip = n;
      return qb;
    }),
    getManyAndCount: vi.fn(async () => {
      const filtered = store.filter((p) => conds.every((c) => c(p)) && !p.deletedAt);
      return [filtered.slice(skip, skip + take), filtered.length];
    }),
  };
  return qb;
}

function makeProductsRepo(
  store: PRow[],
  ents: Array<Partial<Entrepreneur> & { id: string }>,
) {
  return {
    store,
    create: vi.fn((data: Partial<Product>) => ({ id: 'p' + (store.length + 1), ...data }) as PRow),
    save: vi.fn(async (e: PRow) => {
      const i = store.findIndex((x) => x.id === e.id);
      if (i >= 0) store[i] = { ...store[i], ...e };
      else store.push({ ...e, stock: e.stock ?? null });
      return e as Product;
    }),
    findOne: vi.fn(async ({ where }: { where: { id?: string; entrepreneurId?: unknown } }) => {
      return (
        store.find((e) => {
          if (where.id && e.id !== where.id) return false;
          if (where.entrepreneurId) {
            const raw = where.entrepreneurId as unknown;
            const vals =
              raw && typeof raw === 'object' && 'value' in (raw as object)
                ? ((raw as { value: unknown }).value as unknown[])
                : [raw];
            if (!vals.includes(e.entrepreneurId)) return false;
          }
          return true;
        }) ?? null
      );
    }),
    softRemove: vi.fn(async (e: PRow) => {
      e.deletedAt = new Date();
      return e as Product;
    }),
    createQueryBuilder: vi.fn(() => buildProductQb(store, ents)),
  };
}

function makeCategoriesRepo(store: Array<Partial<ProductCategory> & { id: string }>) {
  return {
    exists: vi.fn(async ({ where }: { where: { id: string } }) =>
      store.some((c) => c.id === where.id),
    ),
    findOne: vi.fn(async ({ where }: { where: { id: string; slug?: string } }) =>
      store.find(
        (c) =>
          (!where.id || c.id === where.id) && (!where.slug || c.slug === where.slug),
      ) ?? null,
    ),
  };
}

function makeImagesRepo() {
  const store: Array<Partial<ProductImage> & { id: string; productId: string }> = [];
  return {
    store,
    find: vi.fn(async ({ where }: { where: { productId: unknown } }) => {
      const raw = where.productId as unknown;
      // In([...]) llega como FindOperator con getter .value
      const vals =
        Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as { value?: unknown }).value)
            ? ((raw as { value: unknown[] }).value)
            : [raw];
      return store.filter((i) => vals.includes(i.productId));
    }),
    delete: vi.fn(async ({ productId }: { productId: string }) => {
      const keep = store.filter((i) => i.productId !== productId);
      store.length = 0;
      store.push(...keep);
    }),
    save: vi.fn(async (es: Array<Partial<ProductImage>>) => {
      for (const e of es) {
        const img = { ...e, id: 'i' + (store.length + 1) } as ProductImage;
        store.push(img);
      }
      return es;
    }),
    create: vi.fn((data: Partial<ProductImage>) => data as ProductImage),
  };
}

function makeEntrepreneursRepo(store: Array<Partial<Entrepreneur> & { id: string }>) {
  return {
    find: vi.fn(async ({ where }: { where: { ownerId?: string; id?: string } }) =>
      store.filter((e) => (!where.ownerId || e.ownerId === where.ownerId) && (!where.id || e.id === where.id)) as Entrepreneur[],
    ),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
      store.find((e) => e.id === where.id) ?? null,
    ),
  };
}

describe('ProductsService (unit)', () => {
  let service: ProductsService;
  let productsRepo: ReturnType<typeof makeProductsRepo>;
  let imagesRepo: ReturnType<typeof makeImagesRepo>;
  const ents = [
    {
      id: 'e1',
      ownerId: 'u1',
      status: EntrepreneurStatus.APPROVED,
      name: 'Miel Dorada',
      description: 'Miel pura de apicultores locales de pequenas granjas.',
    },
    {
      id: 'e2',
      ownerId: 'u1',
      status: EntrepreneurStatus.PENDING,
      name: 'Cafe Verde',
      description: 'Cafe de altura tostado artesanalmente cada semana.',
    },
    {
      id: 'e3',
      ownerId: 'u2',
      status: EntrepreneurStatus.APPROVED,
      name: 'Ajeno',
      description: 'Emprendimiento de otro usuario para casos de permisos.',
    },
  ];
  const cats = [{ id: 'c1', name: 'Alimentos', slug: 'alimentos' }];

  beforeEach(async () => {
    productsRepo = makeProductsRepo([], ents);
    imagesRepo = makeImagesRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(ProductCategory), useValue: makeCategoriesRepo(cats) },
        { provide: getRepositoryToken(ProductImage), useValue: imagesRepo },
        { provide: getRepositoryToken(Entrepreneur), useValue: makeEntrepreneursRepo(ents) },
      ],
    }).compile();
    service = moduleRef.get(ProductsService);
  });

  it('create: sin entrepreneurId usa el unico emprendimiento del usuario', async () => {
    const u = { ...user('emprendedor'), userId: 'u2' };
    const res = await service.create(u, {
      name: 'Taza de Barro',
      description: 'Tazas hechas a mano con barro rojo del pueblo.',
      priceCents: 1250,
      categoryId: 'c1',
    });
    expect(res.entrepreneurId).toBe('e3'); // u2 solo posee e3
    expect(res.status).toBe(ProductStatus.DRAFT);
    expect(res.price).toBe('12.50');
  });

  it('create: sin emprendimientos -> 400 con mensaje claro', async () => {
    const u = { ...user('comprador'), userId: 'nobody' };
    await expect(
      service.create(u, {
        name: 'X',
        description: 'Descripcion suficientemente larga para pasar.',
        priceCents: 100,
        categoryId: 'c1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: categoria inexistente -> 404', async () => {
    await expect(
      service.create(user('emprendedor'), {
        name: 'Pan de Masa Madre',
        description: 'Pan artesanal de fermentacion lenta con harina local.',
        priceCents: 500,
        categoryId: 'no-existe',
        entrepreneurId: 'e1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create: producto de otro dueño -> 403', async () => {
    const u = { ...user('emprendedor'), userId: 'u2' };
    await expect(
      service.create(u, {
        name: 'Intruso',
        description: 'Descripcion suficientemente larga para pasar.',
        priceCents: 100,
        categoryId: 'c1',
        entrepreneurId: 'e1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publish: exige emprendimiento aprobado y contenido completo', async () => {
    // u1 tiene e1 (aprobado) y e2 (pendiente): hay que indicar entrepreneurId
    const ok = await service.create(user('emprendedor'), {
      name: 'Miel de Flores',
      description: 'Miel monofloral cosechada en primavera de la sierra.',
      priceCents: 5600,
      categoryId: 'c1',
      entrepreneurId: 'e1',
    });
    const published = await service.publish(ok.id, user('emprendedor'));
    expect(published.status).toBe(ProductStatus.PUBLISHED);

    const draft = await service.create(user('emprendedor'), {
      name: 'Cafe.pending',
      description: 'Producto atado a un emprendimiento aun pendiente.',
      priceCents: 2000,
      categoryId: 'c1',
      entrepreneurId: 'e2',
    });
    await expect(service.publish(draft.id, user('emprendedor'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('viewAs: dueño puede ver, otro usuario no (404)', async () => {
    const p = await service.create(user('emprendedor'), {
      name: 'Escoba de Retama',
      description: 'Escobas artesanales de retama trenzada a mano.',
      priceCents: 900,
      categoryId: 'c1',
      entrepreneurId: 'e1',
    });
    const u1 = { ...user('emprendedor'), userId: 'u2' };
    await expect(service.viewAs(p.id, u1)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.viewAs(p.id, user('emprendedor'))).resolves.toBeDefined();
    await expect(service.viewAs(p.id, user('admin', 'adm'))).resolves.toBeDefined(); // admin si
  });

  it('update recalcula precio y set de imagenes; publicado vuelve a borrador', async () => {
    const p = await service.create(user('emprendedor'), {
      name: 'Vela de Cera',
      description: 'Velas artesanales de cera de abeja con aroma a ciboulette.',
      priceCents: 1500,
      categoryId: 'c1',
      entrepreneurId: 'e1',
      images: ['https://cdn.local/a.jpg'],
    });
    expect(p.images).toEqual(['https://cdn.local/a.jpg']);
    await service.publish(p.id, user('emprendedor'));
    const upd = await service.update(p.id, user('emprendedor'), {
      priceCents: 1800,
      images: ['https://cdn.local/b.jpg', 'https://cdn.local/c.jpg'],
    });
    expect(upd.price).toBe('18.00');
    expect(upd.images).toEqual(['https://cdn.local/b.jpg', 'https://cdn.local/c.jpg']);
    expect(upd.status).toBe(ProductStatus.DRAFT); // re-revision tras edicion
  });

  it('listApproved solo expone publicado+activo+emprendimiento aprobado, con q y paginacion', async () => {
    // Publico dos en un emprendimiento aprobado, uno en pendiente
    const a = await service.create(user('emprendedor'), {
      name: 'Jabon de Miel',
      description: 'Jabon artesanal de miel y avena con toques dulces.',
      priceCents: 700,
      categoryId: 'c1',
      entrepreneurId: 'e1',
    });
    await service.publish(a.id, user('emprendedor'));
    const b = await service.create(user('emprendedor'), {
      name: 'Jabon Carbon',
      description: 'Jabon negro de carbon activado para piel grasa.',
      priceCents: 800,
      categoryId: 'c1',
      entrepreneurId: 'e1',
    });
    await service.publish(b.id, user('emprendedor'));
    await service.unpublish(b.id, user('emprendedor'));
    const d = await service.create(user('emprendedor'), {
      name: 'Jabon Eucalipto',
      description: 'Jabon refrescante de eucalipto de las sierras del sur.',
      priceCents: 800,
      categoryId: 'c1',
      entrepreneurId: 'e2', // emprendimiento pendiente: no sale
    });

    const pub = await service.listApproved({ page: 1, limit: 50 });
    expect(pub.items.map((p) => p.name)).toEqual(['Jabon de Miel']);
    expect(pub.total).toBe(1);

    // listMine del dueño las ve todas
    const mine = await service.listMine(user('emprendedor'), { page: 1, limit: 50 });
    expect(mine.total).toBe(3);
    const byStatus = new Map(mine.items.map((p) => [p.name, p.status]));
    expect(byStatus.get('Jabon de Miel')).toBe(ProductStatus.PUBLISHED);
    expect(byStatus.get('Jabon Carbon')).toBe(ProductStatus.UNPUBLISHED);
    expect(byStatus.get('Jabon Eucalipto')).toBe(ProductStatus.DRAFT);

    // remove hace soft-delete: deja de estar en mine
    await service.remove(a.id, user('emprendedor'));
    const mine2 = await service.listMine(user('emprendedor'), { page: 1, limit: 50 });
    expect(mine2.items.map((p) => p.name)).not.toContain('Jabon de Miel');
  });
});
