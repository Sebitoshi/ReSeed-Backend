import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Entrepreneur } from '../../entrepreneurs/entities/entrepreneur.entity.js';

export enum PaymentStatus {
  PENDING = 'pendiente',
  APPROVED = 'aprobado',
  REJECTED = 'rechazado',
  REFUNDED = 'reembolsado',
  CANCELLED = 'cancelado',
}

@Entity('payments')
@Index('idx_payments_external_ref', ['externalRef'], { unique: true })
@Index('idx_payments_payer', ['payerUserId'])
@Index('idx_payments_status', ['status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Referencia externa de la pasarela (id de transaccion/intencion). Unico:
  // es el cinturon de seguridad contra dobles procesamientos.
  @Column({ type: 'varchar', length: 255, name: 'external_ref' })
  externalRef!: string;

  // Postgres bigint llega como string desde pg: el transformer lo normaliza.
  @Column({ type: 'bigint', name: 'amount_cents', transformer: { to: (v) => v, from: (v) => (v == null ? v : Number(v)) } })
  amountCents!: number;

  @Column({ type: 'bigint', name: 'net_amount_cents', transformer: { to: (v) => v, from: (v) => (v == null ? v : Number(v)) } })
  netAmountCents!: number;

  // Moneda local del marketplace: pesos colombianos.
  @Column({ type: 'varchar', length: 5, default: 'COP', name: 'currency_code' })
  currencyCode!: string;

  @Column({ type: 'enum', enum: PaymentStatus })
  status!: PaymentStatus;

  // Quien pagó (null = pasarela nunca confirmó un pagador).
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'payer_user_id' })
  payer?: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'payer_user_id' })
  payerUserId!: string | null;

  // Emprendimiento que cobra; sirve para reportes por vendedor.
  @ManyToOne(() => Entrepreneur, { nullable: true })
  @JoinColumn({ name: 'entrepreneur_id' })
  entrepreneur?: Entrepreneur | null;

  @Column({ type: 'uuid', nullable: true, name: 'entrepreneur_id' })
  entrepreneurId!: string | null;

  // Monto que queda por reembolsar (cents). 0 = nada reembolsado, igual a total.
  @Column({ type: 'bigint', name: 'refunded_amount_cents', transformer: { to: (v) => v, from: (v) => (v == null ? v : Number(v)) } })
  refundedAmountCents!: number;

  // Idioma y descripción del cobro, para el checkout hosted.
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // Fecha en que la pasarela confirmó (null si nunca fue aprobado o cancelado).
  @Column({ type: 'timestamptz', nullable: true, name: 'confirmed_at' })
  confirmedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
