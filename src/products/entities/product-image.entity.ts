import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('product_images')
@Index('idx_product_images_product', ['productId'])
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  url!: string;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @Column({ type: 'boolean', default: true, name: 'is_primary' })
  isPrimary!: boolean;

  @Column({ name: 'product_id' })
  productId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
