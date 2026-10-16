import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Price,
  Product,
  ProductStatus,
  ProductType,
  PublicProduct,
} from './entities/product.entity.js';
import type {
  CreateProductDto,
  ListProductsQueryDto,
  ListRawMaterialsQueryDto,
  UpdateProductDto,
} from './dto/product.dto.js';
import { ProductCategory } from './entities/product-category.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { EntrepreneurStatus } from '../entrepreneurs/entities/entrepreneur.entity.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { DEFAULT_PAGE_SIZE } from '../entrepreneurs/dto/list-query.dto.js';
import type { Paginated } from '../entrepreneurs/entrepreneurs.service.js';
import { PlatformSellerService } from '../platform/platform-seller.service.js';

export interface OwnerProduct extends PublicProduct {
  entrepreneurId: string;
  status: ProductStatus;
  updatedAt: Date;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categories: Repository<ProductCategory>,
    @InjectRepository(ProductImage)
    private readonly imagesRepo: Repository<ProductImage>,
    @InjectRepository(Entrepreneur)
    private readonly entrepreneurs: Repository<Entrepreneur>,
    private readonly platformSeller: PlatformSellerService,
  ) {}

  // ---------- Helpers ----------

  private toPublic(p: Product, images: ProductImage[]): PublicProduct {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      price: Price.centsToDecimalString(p.priceCents),
      stock: p.stock,
      available: p.stock,
      isActive: p.isActive,
      images: images.slice().sort((a, b) => a.position - b.position).map((i) => i.url),
      categoryId: p.categoryId,
      type: p.type,
      isRawMaterial: p.type === ProductType.RAW_MATERIAL,
      createdAt: p.createdAt,
    };
  }

  private async withImages(products: Product[]): Promise<PublicProduct[]> {
    const ids = products.map((p) => p.id);
    const imgs = ids.length
      ? await this.imagesRepo.find({ where: { productId: In(ids) } })
      : [];
    const byProduct = new Map<string, ProductImage[]>();
    for (const img of imgs) {
      const list = byProduct.get(img.productId) ?? [];
      list.push(img);
      byProduct.set(img.productId, list);
    }
    return products.map((p) => this.toPublic(p, byProduct.get(p.id) ?? []));
  }

  private toOwnerView(
    p: PublicProduct,
    entrepreneurId: string,
    status: ProductStatus,
    updatedAt: Date,
  ): OwnerProduct {
    return { ...p, entrepreneurId, status, updatedAt };
  }

  private async findOwnedBy(id: string, entrepreneurIds: string[]): Promise<Product | null> {
    if (entrepreneurIds.length === 0) return null;
    return this.repo.findOne({
      where: { id, entrepreneurId: In(entrepreneurIds) },
    });
  }

  private async resolveEntrepreneur(user: AuthUser, entrepreneurId?: string): Promise<Entrepreneur> {
    if (entrepreneurId) {
      const found = await this.entrepreneurs.findOne({ where: { id: entrepreneurId } });
      if (!found) throw new NotFoundException('Emprendimiento no encontrado');
      const isOwner = found.ownerId === user.userId;
      if (!isOwner && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('No es tu emprendimiento');
      }
      return found;
    }
    // Sin emprendimiento explicito: si el usuario tiene exactamente uno, ese; si no, error.
    const owned = await this.entrepreneurs.find({ where: { ownerId: user.userId } });
    if (owned.length === 1) return owned[0]!;
    if (owned.length === 0) {
      throw new BadRequestException('Primero crea tu emprendimiento');
    }
    throw new BadRequestException(
      'Tienes varios emprendimientos: indica entrepreneurId del producto',
    );
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const exists = await this.categories.exists({ where: { id: categoryId } });
    if (!exists) throw new NotFoundException('Categoria no encontrada');
  }

  private async attachImages(productId: string, urls: string[]): Promise<void> {
    // Set completo: borramos y reinsertamos (max 8).
    await this.imagesRepo.delete({ productId });
    const entities = urls.slice(0, 8).map((url, position) =>
      this.imagesRepo.create({
        url: url.trim(),
        position,
        isPrimary: position === 0,
        productId,
      }),
    );
    if (entities.length) await this.imagesRepo.save(entities);
  }

  // ---------- Publico ----------

  async listApproved(q: ListProductsQueryDto): Promise<Paginated<PublicProduct>> {
    const qb = this.repo
      .createQueryBuilder('p')
      .innerJoin('p.entrepreneur', 'e')
      .where('p.status = :published', { published: ProductStatus.PUBLISHED })
      .andWhere('p.isActive = true')
      .andWhere('e.status = :approved', { approved: EntrepreneurStatus.APPROVED });

    if (q.categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId: q.categoryId });
    }
    if (q.entrepreneurId) {
      qb.andWhere('p.entrepreneurId = :entrepreneurId', { entrepreneurId: q.entrepreneurId });
    }
    if (q.type) {
      qb.andWhere('p.type = :type', { type: q.type });
    }
    if (q.q) {
      const term = `%${q.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(p.name) LIKE :term OR LOWER(p.description) LIKE :term)', { term });
    }

    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? DEFAULT_PAGE_SIZE));
    const [rows, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();

    return {
      items: await this.withImages(rows),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getApprovedById(id: string): Promise<PublicProduct> {
    const p = await this.repo
      .createQueryBuilder('p')
      .innerJoin('p.entrepreneur', 'e')
      .where('p.id = :id', { id })
      .andWhere('p.status = :published', { published: ProductStatus.PUBLISHED })
      .andWhere('p.isActive = true')
      .andWhere('e.status = :approved', { approved: EntrepreneurStatus.APPROVED })
      .getOne();
    if (!p) throw new NotFoundException('Producto no encontrado');
    return (await this.withImages([p]))[0]!;
  }

  // ---------- Dueño/admin ----------

  async create(user: AuthUser, dto: CreateProductDto): Promise<OwnerProduct> {
    const entrepreneur = await this.resolveEntrepreneur(user, dto.entrepreneurId);
    await this.assertCategory(dto.categoryId);
    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name.trim(),
        description: dto.description,
        priceCents: dto.priceCents,
        stock: dto.stock ?? null,
        isActive: dto.isActive ?? true,
        status: ProductStatus.DRAFT,
        type: ProductType.CRAFT,
        categoryId: dto.categoryId,
        entrepreneurId: entrepreneur.id,
      }),
    );
    if (dto.images?.length) {
      await this.attachImages(saved.id, dto.images);
    }
    const pub = (await this.withImages([saved]))[0]!;
    return {
      ...pub,
      entrepreneurId: saved.entrepreneurId,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  private async entrepreneursIdsOf(ownerId: string): Promise<string[]> {
    const rows = await this.entrepreneurs.find({ where: { ownerId } });
    return rows.map((r) => r.id);
  }

  async listMine(user: AuthUser, q: ListProductsQueryDto): Promise<Paginated<OwnerProduct>> {
    const ownedIds = await this.entrepreneursIdsOf(user.userId);
    if (ownedIds.length === 0) {
      return { items: [], total: 0, page: 1, limit: q.limit ?? DEFAULT_PAGE_SIZE, totalPages: 0 };
    }
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.entrepreneurId IN (:...ownedIds)', { ownedIds });
    if (q.categoryId) qb.andWhere('p.categoryId = :categoryId', { categoryId: q.categoryId });
    if (q.q) {
      const term = `%${q.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(p.name) LIKE :term OR LOWER(p.description) LIKE :term)', { term });
    }
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? DEFAULT_PAGE_SIZE));
    const [rows, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    const prods = (await this.withImages(rows)) as OwnerProduct[];
    return {
      items: prods.map((p, i) => ({
        ...p,
        entrepreneurId: rows[i]!.entrepreneurId,
        status: rows[i]!.status,
        updatedAt: rows[i]!.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------- Materia prima (plataforma) ----------

  private assertAdmin(user: AuthUser): void {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede gestionar la materia prima');
    }
  }

  /** Listado de materia prima para el panel admin (cualquier estado). */
  async listRawMaterials(
    user: AuthUser,
    q: ListRawMaterialsQueryDto,
  ): Promise<Paginated<OwnerProduct>> {
    this.assertAdmin(user);
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.type = :type', { type: ProductType.RAW_MATERIAL });
    if (q.includeArchived) qb.withDeleted();
    else qb.andWhere('p.deletedAt IS NULL');
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.q) {
      const term = `%${q.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(p.name) LIKE :term OR LOWER(p.description) LIKE :term)', { term });
    }
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? DEFAULT_PAGE_SIZE));
    const [rows, total] = await qb
      .orderBy('p.updatedAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    const prods = (await this.withImages(rows)) as OwnerProduct[];
    return {
      items: prods.map((p, i) => ({
        ...p,
        entrepreneurId: rows[i]!.entrepreneurId,
        status: rows[i]!.status,
        updatedAt: rows[i]!.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Crea materia prima a nombre de la plataforma (borrador).
   *
   * El emprendimiento vendedor es la ficha del sistema, que se crea sola la
   * primera vez. El admin la edita y publica como cualquier producto.
   */
  async createRawMaterial(user: AuthUser, dto: CreateProductDto): Promise<OwnerProduct> {
    this.assertAdmin(user);
    const seller = await this.platformSeller.getOrCreate();
    await this.assertCategory(dto.categoryId);
    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name.trim(),
        description: dto.description,
        priceCents: dto.priceCents,
        stock: dto.stock ?? null,
        isActive: dto.isActive ?? true,
        status: ProductStatus.DRAFT,
        type: ProductType.RAW_MATERIAL,
        categoryId: dto.categoryId,
        entrepreneurId: seller.id,
      }),
    );
    if (dto.images?.length) {
      await this.attachImages(saved.id, dto.images);
    }
    const pub = (await this.withImages([saved]))[0]!;
    return {
      ...pub,
      entrepreneurId: saved.entrepreneurId,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  /** Restaura materia prima archivada (solo admin). */
  async restoreRawMaterial(id: string, user: AuthUser): Promise<OwnerProduct> {
    this.assertAdmin(user);
    const product = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (!product.deletedAt) throw new BadRequestException('El producto no esta archivado');
    await this.repo.recover(product);
    return this.viewAs(id, user);
  }

  async viewAs(id: string, user: AuthUser): Promise<OwnerProduct> {
    let product: Product | null;
    if (user.role === UserRole.ADMIN) {
      product = await this.repo.findOne({ where: { id } });
    } else {
      product = await this.findOwnedBy(id, await this.entrepreneursIdsOf(user.userId));
    }
    if (!product) throw new NotFoundException('Producto no encontrado');
    const pub = (await this.withImages([product]))[0]!;
    return {
      ...pub,
      entrepreneurId: product.entrepreneurId,
      status: product.status,
      updatedAt: product.updatedAt,
    };
  }

  private async findEditableProduct(id: string, user: AuthUser): Promise<Product> {
    let product: Product | null;
    if (user.role === UserRole.ADMIN) {
      product = await this.repo.findOne({ where: { id } });
    } else {
      product = await this.findOwnedBy(id, await this.entrepreneursIdsOf(user.userId));
    }
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async update(id: string, user: AuthUser, dto: UpdateProductDto): Promise<OwnerProduct> {
    const product = await this.findEditableProduct(id, user);
    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.priceCents !== undefined) product.priceCents = dto.priceCents;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    if (dto.categoryId !== undefined) {
      await this.assertCategory(dto.categoryId);
      product.categoryId = dto.categoryId;
    }
    // Editar un publicado vuelve a borrador (regla editorial).
    if (product.status === ProductStatus.PUBLISHED) {
      product.status = ProductStatus.DRAFT;
    }
    const saved = await this.repo.save(product);
    if (dto.images !== undefined) {
      await this.attachImages(product.id, dto.images);
    }
    const pub = (await this.withImages([saved]))[0]!;
    return {
      ...pub,
      entrepreneurId: saved.entrepreneurId,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  }

  /** Publica si su emprendimiento esta aprobado y el contenido esta completo. */
  async publish(id: string, user: AuthUser): Promise<OwnerProduct> {
    const product = await this.findEditableProduct(id, user);
    const entrepreneur = await this.entrepreneurs.findOne({
      where: { id: product.entrepreneurId },
    });
    if (!entrepreneur) throw new NotFoundException('Emprendimiento del producto no existe');
    if (product.status !== ProductStatus.PUBLISHED) {
      if (entrepreneur.status !== EntrepreneurStatus.APPROVED) {
        throw new BadRequestException(
          'El emprendimiento debe estar aprobado para publicar productos',
        );
      }
      if (product.name.length < 2 || product.description.length < 10) {
        throw new BadRequestException('Producto incompleto: nombre y descripcion requeridos');
      }
      product.status = ProductStatus.PUBLISHED;
      await this.repo.save(product);
    }
    return this.viewAs(id, user);
  }

  /** Quita del catalogo sin borrar. */
  async unpublish(id: string, user: AuthUser): Promise<OwnerProduct> {
    const product = await this.findEditableProduct(id, user);
    product.status = ProductStatus.UNPUBLISHED;
    await this.repo.save(product);
    return this.viewAs(id, user);
  }

  /** Soft-delete por el dueño o el admin. */
  async remove(id: string, user: AuthUser): Promise<void> {
    const product = await this.findEditableProduct(id, user);
    await this.repo.softRemove(product);
  }
}
