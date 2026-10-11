import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export enum VolunteerStatus {
  DRAFT = 'borrador',
  OPEN = 'abierta',
  CLOSED = 'cerrada',
  DONE = 'finalizada',
}

export enum SignupStatus {
  PENDING = 'pendiente',
  CONFIRMED = 'confirmado',
  REJECTED = 'rechazado',
  CANCELLED = 'cancelado',
}

@Entity('volunteer_activities')
@Index('idx_volunteer_status', ['status'])
export class VolunteerActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date | null;

  // Cupos disponibles; null = ilimitado.
  @Column({ type: 'integer', nullable: true })
  slots?: number | null;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'enum', enum: VolunteerStatus, default: VolunteerStatus.DRAFT })
  status!: VolunteerStatus;

  @Index()
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null;

  @OneToMany(() => VolunteerSignup, (s) => s.activity)
  signups!: VolunteerSignup[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}

@Entity('volunteer_signups')
@Index('idx_signups_activity', ['activityId'])
@Index('idx_signups_user', ['userId'])
export class VolunteerSignup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => VolunteerActivity, (a) => a.signups, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity!: VolunteerActivity;

  @Column({ name: 'activity_id', type: 'uuid' })
  activityId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: SignupStatus, default: SignupStatus.PENDING })
  status!: SignupStatus;

  // Motivo al rechazar; visible para el voluntario.
  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
