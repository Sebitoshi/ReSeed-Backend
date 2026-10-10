import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntrepreneurStatus } from './entrepreneur.entity.js';

// El rol viaja como string en el JWT; solo lo necesitamos guardar como tal.
export interface ActorLike {
  id: string;
  role: string;
}

@Entity('entrepreneur_status_logs')
@Index(['entrepreneurId', 'createdAt'])
export class EntrepreneurStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'entrepreneur_id', type: 'uuid' })
  entrepreneurId!: string;

  @Column({ name: 'to_status', type: 'enum', enum: EntrepreneurStatus })
  toStatus!: EntrepreneurStatus;

  // Quien hizo la accion (admin en revision; el dueño en submit/resubmit).
  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @Column({ name: 'actor_role', type: 'varchar', length: 20 })
  actorRole!: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
