import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Entrepreneur } from '../../entrepreneurs/entities/entrepreneur.entity.js';
import { ProductCategory } from './product-category.entity.js';

export enum ProductStatus {
  DRAFT = 'borrador',
  PUBLISHED = 'publicado',
  UNPUBLISHED = 'despublicado',
}

export class Price {
  /** Centavos -> "12.50" (string estable, sin flotantes). */
  static centsToDecimalString(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(Math.trunc(cents));
    const units = Math.floor(abs / 100);
    const frac = `${abs % 100}`.padStart(2, '0');
    return `${sign}${units}.${frac}`;
  }
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string;
  /** Precio en centavos (unidad menor). */
  priceCents: number;
  /** Representacion decimal estable, p.ej. "12.50". */
  price: string;
  /** null = ilimitado (servicio). */
  stock: number | null;
  available: number | null;
  isActive: boolean;
  images: string[];
  categoryId: string;
  createdAt: Date;
}

@Entity('products')
@Index('idx_products_entrepreneur', ['entrepreneurId'])
@Index('idx_products_status', ['status'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 180 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  // Precio en la unidad menor (centavos) para evitar errores de redondeo.
  @Column({ type: 'integer', name: 'price_cents' })
  priceCents!: number;

  // null = servicio o producto sin stock finito.
  @Column({ type: 'integer', nullable: true, name: 'stock' })
  stock!: number | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 20, default: ProductStatus.DRAFT })
  status!: ProductStatus;

  @ManyToOne(() => ProductCategory, (c) => c.children, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category!: ProductCategory;

  @Column({ name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => Entrepreneur, { nullable: false })
  @JoinColumn({ name: 'entrepreneur_id' })
  entrepreneur!: Entrepreneur;

  @Column({ name: 'entrepreneur_id' })
  entrepreneurId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
