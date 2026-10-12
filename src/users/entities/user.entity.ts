import {
  CreateDateColumn,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  ENTREPRENEUR = 'emprendedor',
  BUYER = 'comprador',
  VOLUNTEER = 'voluntario',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  // Hash bcrypt; nunca se expone fuera del servicio.
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.BUYER })
  role!: UserRole;

  @Column({ type: 'text', nullable: true })
  bio?: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  phone?: string | null;

  // Desactivacion administrativa: sin esto el login y el JWT se rechazan.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;

  // Verificacion del correo por codigo de 6 digitos. Null = pendiente.
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  // Hash bcrypt del codigo vigente; el codigo en claro solo vive en el correo.
  @Column({ name: 'verification_code_hash', type: 'varchar', length: 255, nullable: true })
  verificationCodeHash?: string | null;

  @Column({ name: 'verification_expires_at', type: 'timestamptz', nullable: true })
  verificationExpiresAt?: Date | null;

  // Para limitar la frecuencia de reenvio y no agotar la cuota del SMTP.
  @Column({ name: 'verification_sent_at', type: 'timestamptz', nullable: true })
  verificationSentAt?: Date | null;

  // Intentos fallidos con el codigo vigente: corta la fuerza bruta.
  @Column({ name: 'verification_attempts', type: 'integer', default: 0 })
  verificationAttempts!: number;

  // Recuperacion de contrasena: mismo patron que la verificacion, con estado
  // propio para que pedir un reset no invalide un codigo de verificacion.
  @Column({ name: 'password_reset_code_hash', type: 'varchar', length: 255, nullable: true })
  passwordResetCodeHash?: string | null;

  @Column({ name: 'password_reset_expires_at', type: 'timestamptz', nullable: true })
  passwordResetExpiresAt?: Date | null;

  @Column({ name: 'password_reset_sent_at', type: 'timestamptz', nullable: true })
  passwordResetSentAt?: Date | null;

  @Column({ name: 'password_reset_attempts', type: 'integer', default: 0 })
  passwordResetAttempts!: number;

  // Momento del ultimo cambio de clave. Los tokens emitidos antes no valen:
  // sin esto, restablecer la clave no desalojaria a quien tenga un token ajeno.
  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
