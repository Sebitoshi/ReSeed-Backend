import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Payment } from './payment.entity.js';

export enum RefundStatus {
  PENDING = 'pendiente',
  APPROVED = 'aprobado',
  REJECTED = 'rechazado',
}

@Entity('payment_refunds')
@Index('idx_refunds_payment', ['paymentId'])
// Un refund externo (id en la pasarela) nunca debe aplicarse dos veces.
@Index('idx_refunds_external_ref', ['externalRef'], { unique: true })
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payment_id' })
  paymentId!: string;

  @ManyToOne(() => Payment, { nullable: false })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment;

  // Postgres bigint llega como string desde pg: el transformer lo normaliza.
  @Column({ type: 'bigint', name: 'amount_cents', transformer: { to: (v) => v, from: (v) => (v == null ? v : Number(v)) } })
  amountCents!: number;

  @Column({ type: 'enum', enum: RefundStatus })
  status!: RefundStatus;

  @Column({ type: 'varchar', length: 255, name: 'external_ref' })
  externalRef!: string;

  @Column({ type: 'varchar', length: 255, name: 'actor_user_id' })
  actorUserId!: string;

  @Column({ type: 'text', nullable: true, name: 'reason' })
  reason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
