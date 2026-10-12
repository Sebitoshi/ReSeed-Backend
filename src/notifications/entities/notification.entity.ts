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

export enum NotificationType {
  REGISTRO = 'registro',
  VERIFICACION = 'verificacion',
  PAGO = 'pago',
  REEMBOLSO = 'reembolso',
  EMPRENDIMIENTO = 'emprendimiento',
  VOLUNTARIADO = 'voluntariado',
  CAMPANA = 'campana',
  SISTEMA = 'sistema',
}

export enum NotificationStatus {
  /** El correo se entrego al SMTP sin errores. */
  ENVIADA = 'enviada',
  /** El envio fallo (SMTP mal configurado, red, etc). */
  FALLIDA = 'fallida',
  /** No se intento enviar: SMTP deshabilitado o sin credenciales. */
  OMITIDA = 'omitida',
}

/**
 * Registro persistente de cada notificacion enviada al usuario.
 * Es el historial que consulta el dueño y el log que revisa el admin.
 * El email destino se guarda aparte del usuario para no perder el dato
 * aunque la cuenta se elimine.
 */
@Entity('notifications')
@Index('idx_notifications_user_created', ['userId', 'createdAt'])
@Index('idx_notifications_type', ['type'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'to_email', type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.SISTEMA })
  type!: NotificationType;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.OMITIDA })
  status!: NotificationStatus;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  // Cuerpo HTML tal cual se envio (tambien sirve para reenvios).
  @Column({ type: 'text' })
  body!: string;

  // Entidad que desencadeno la notificacion (pago, emprendimiento, ...).
  @Column({ name: 'reference_type', type: 'varchar', length: 60, nullable: true })
  referenceType?: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId?: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ name: 'attempts', type: 'integer', default: 1 })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
