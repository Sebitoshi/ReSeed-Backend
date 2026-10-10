import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory, ROOT_CATEGORY_SLUG } from './entities/product-category.entity.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { Product } from './entities/product.entity.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryTreeNode[];
}

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly repo: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  /** Arbol publico (activo) para el front. */
  async tree(): Promise<CategoryTreeNode[]> {
    const roots = await this.repo.find({
      where: { isActive: true },
      relations: { children: true },
      order: { name: 'ASC' },
    });
    const asTree: CategoryTreeNode[] = roots
      .filter((r) => !r.parentId)
      .map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        children: (r.children ?? [])
          .filter((c) => c.isActive)
          .map((c) => ({ id: c.id, name: c.name, slug: c.slug, children: [] })),
      }));
    return asTree;
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Solo el administrador gestiona categorias');
    }
  }

  async create(user: AuthUser, input: { name: string; parentId?: string | null; isActive?: boolean }): Promise<ProductCategory> {
    this.assertAdmin(user);
    const name = input.name.trim();
    let slug = slugify(name);
    if (!slug || slug === ROOT_CATEGORY_SLUG) {
      throw new BadRequestException('El nombre de la categoria es invalido');
    }
    let candidate = slug;
    let n = 1;
    while (await this.repo.exists({ where: { slug: candidate } })) {
      candidate = `${slug}-${++n}`;
    }
    slug = candidate;
    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await this.repo.findOne({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundException('Categoria padre no encontrada');
      if (parent.parentId) {
        throw new BadRequestException('Solo se permite 1 nivel de subcategorias');
      }
      parentId = parent.id;
    }
    return this.repo.save(this.repo.create({ name, slug, parentId, isActive: input.isActive ?? true }));
  }

  async update(user: AuthUser, id: string, patch: { name?: string; isActive?: boolean }): Promise<ProductCategory> {
    this.assertAdmin(user);
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Categoria no encontrada');
    if (cat.slug === ROOT_CATEGORY_SLUG) {
      throw new BadRequestException('La categoria raiz no es editable');
    }
    if (patch.name !== undefined) cat.name = patch.name.trim();
    if (patch.isActive !== undefined) cat.isActive = patch.isActive;
    return this.repo.save(cat);
  }

  /** Desactiva la categoria (soft-off). No borra productos. */
  async deactivate(user: AuthUser, id: string): Promise<void> {
    this.assertAdmin(user);
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Categoria no encontrada');
    cat.isActive = false;
    await this.repo.save(cat);
  }

  /** Conteo de productos publicados por categoria, para el front. */
  async counts(): Promise<Array<{ categoryId: string; name: string; products: number }>> {
    const rows = await this.products
      .createQueryBuilder('p')
      .select('p.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'products')
      .where('p.status = :published', { published: 'publicado' })
      .groupBy('p.categoryId')
      .getRawMany<{ categoryId: string; products: string }>();
    const all = await this.repo.find({ order: { name: 'ASC' } });
    const map = new Map(rows.map((r) => [r.categoryId, Number(r.products)]));
    return all.map((c) => ({ categoryId: c.id, name: c.name, products: map.get(c.id) ?? 0 }));
  }
}
