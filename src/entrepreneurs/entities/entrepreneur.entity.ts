import {
  CreateDateColumn,
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum EntrepreneurStatus {
  PENDING = 'pendiente',
  APPROVED = 'aprobado',
  REJECTED = 'rechazado',
  SUSPENDED = 'suspendido',
}

@Entity('entrepreneurs')
@Index(['status'])
export class Entrepreneur {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  // Identificador publico en URL; se genera desde name y es unico.
  @Column({ type: 'varchar', length: 160, unique: true })
  slug!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logoUrl?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contactPhone?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail?: string | null;

  @Column({
    type: 'enum',
    enum: EntrepreneurStatus,
    default: EntrepreneurStatus.PENDING,
  })
  status!: EntrepreneurStatus;

  // Motivo al rechazar o suspender; visible para el dueño.
  @Column({ type: 'text', nullable: true })
  reviewNote?: string | null;

  // Emprendedor dueño de este emprendimiento.
  @Index()
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Soft-delete: si esta presente, la ficha esta archivada.
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
