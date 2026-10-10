import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const ROOT_CATEGORY_SLUG = '__root__';

@Entity('product_categories')
@Index('idx_product_categories_slug', ['slug'], { unique: true })
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 140 })
  slug!: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => ProductCategory, (c) => c.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: ProductCategory | null;

  @OneToMany(() => ProductCategory, (c) => c.parent)
  children!: ProductCategory[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
