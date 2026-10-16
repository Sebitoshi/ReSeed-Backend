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
import { Campaign } from '../../campaigns/entities/campaign.entity.js';
import { Payment } from '../../payments/entities/payment.entity.js';

export enum DonationStatus {
  PENDING = 'pendiente',
  APPROVED = 'aprobado',
  REJECTED = 'rechazado',
  CANCELLED = 'cancelado',
  REFUNDED = 'reembolsado',
}

/**
 * Aporte economico de un usuario. Puede ir a una campana concreta
 * (`campaign_id`) o al fondo general de la plataforma (`campaign_id` null).
 *
 * El cobro vive en `payments`: cada donacion nace con el id del pago que la
 * financia y copia su estado, para que donaciones y pagos nunca se contradigan.
 */
@Entity('donations')
@Index('idx_donations_donor', ['donorUserId'])
@Index('idx_donations_campaign', ['campaignId'])
@Index('idx_donations_status', ['status'])
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Quien aporta (null si la cuenta se elimino; el aporte queda en el historial).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'donor_user_id' })
  donor?: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'donor_user_id' })
  donorUserId!: string | null;

  // Campana destino; null = fondo general de la plataforma.
  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Campaign | null;

  @Column({ type: 'uuid', nullable: true, name: 'campaign_id' })
  campaignId!: string | null;

  // Pago que financia el aporte. Unico: un pago no puede ser dos donaciones.
  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment | null;

  @Column({ type: 'uuid', nullable: true, name: 'payment_id' })
  paymentId!: string | null;

  // Postgres bigint llega como string desde pg: el transformer lo normaliza.
  @Column({ type: 'bigint', name: 'amount_cents', transformer: { to: (v) => v, from: (v) => (v == null ? v : Number(v)) } })
  amountCents!: number;

  @Column({ type: 'varchar', length: 5, default: 'COP', name: 'currency_code' })
  currencyCode!: string;

  @Column({ type: 'enum', enum: DonationStatus, default: DonationStatus.PENDING })
  status!: DonationStatus;

  // Dedicatoria opcional que se muestra junto al aporte.
  @Column({ type: 'text', nullable: true })
  message?: string | null;

  // Si es anonimo, su nombre no se expone publicamente.
  @Column({ type: 'boolean', default: false })
  anonymous!: boolean;

  // Fecha en que el pago se aprobo (null mientras este pendiente o falle).
  @Column({ type: 'timestamptz', nullable: true, name: 'confirmed_at' })
  confirmedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
