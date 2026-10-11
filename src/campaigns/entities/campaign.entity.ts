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
import { User } from '../../users/entities/user.entity.js';

export enum CampaignStatus {
  DRAFT = 'borrador',
  ACTIVE = 'activa',
  CLOSED = 'finalizada',
}

@Entity('campaigns')
@Index('idx_campaigns_status', ['status'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  // Slug publico en URL, unico y generado desde el titulo.
  @Column({ type: 'varchar', length: 160, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  summary?: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;

  // Meta de recaudo en centavos (null = campana informativa).
  @Column({ name: 'goal_cents', type: 'bigint', nullable: true })
  goalCents?: string | null;

  // Donde se puede aportar; solo informativo (la pasarela se usa en /payments/checkout).
  @Column({ name: 'donation_url', type: 'varchar', length: 255, nullable: true })
  donationUrl?: string | null;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status!: CampaignStatus;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt?: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date | null;

  // Usuario admin que creo la campana.
  @Index()
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
