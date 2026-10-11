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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
