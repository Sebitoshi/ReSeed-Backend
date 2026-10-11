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
import { Product } from '../../products/entities/product.entity.js';

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
export class VolunteerSignup {  @PrimaryGeneratedColumn('uuid')
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

// ---------- Materiales recolectados ----------

export enum MaterialType {
  /** Botellas y envases de polietileno tereftalato. */
  PET = 'pet',
  /** Plastico film, bolsas y empaques flexibles. */
  PLASTICO_FILME = 'plastico_filme',
  /** Plastico rigido (HDPE, PP): tapas, envases de limpieza. */
  PLASTICO_RIGIDO = 'plastico_rigido',
  /** Carton corrugado y cajas. */
  CARTON = 'carton',
  /** Papel de oficina, prensa y revistas. */
  PAPEL = 'papel',
  /** Latas y bandejas de aluminio. */
  ALUMINIO = 'aluminio',
  /** Envases y frascos de vidrio. */
  VIDRIO = 'vidrio',
  /** Chatarra ferrosa y piezas metalicas. */
  METAL = 'metal',
  /** Restos vegetales de la jornada (hortalizas, poda). */
  ORGANICO = 'organico',
  /** Otro material no listado; especificar en notes. */
  OTRO = 'otro',
}

export enum CollectionUnit {
  /** Medida de peso; la cantidad se guarda normalizada en gramos. */
  KG = 'kg',
  /** Conteo de piezas sueltas (botellas, latas, frascos). */
  UNIDAD = 'unidad',
  /** Conteo de bultos cerrados (costales, fardos). */
  BULTO = 'bulto',
}

@Entity('material_collections')
@Index('idx_collections_activity', ['activityId'])
@Index('idx_collections_product', ['rawMaterialProductId'])
export class MaterialCollection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Jornada de la que salio el material. Si se borra la jornada de forma
  // definitiva, la recoleccion queda huérfana y se limpia el vínculo: el
  // registro del material se conserva por trazabilidad.
  @ManyToOne(() => VolunteerActivity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activity_id' })
  activity?: VolunteerActivity | null;

  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId?: string | null;

  @Column({ type: 'enum', enum: MaterialType })
  material!: MaterialType;

  /** Entero en la unidad base (gramos si unit=kg, piezas si no). */
  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'enum', enum: CollectionUnit })
  unit!: CollectionUnit;

  /** Fecha real de la recoleccion; por defecto el momento del registro. */
  @Column({ name: 'collected_at', type: 'timestamptz' })
  collectedAt!: Date;

  // Producto de materia prima en el que se transformo este material. Es el
  // eslabon que cierra la traza: jornada -> material -> materia prima -> socio.
  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'raw_material_product_id' })
  rawMaterialProduct?: Product | null;

  @Column({ name: 'raw_material_product_id', type: 'uuid', nullable: true })
  rawMaterialProductId?: string | null;

  /** Notas libres: calidad, humedad, observaciones de la jornada. */
  @Column({ type: 'text', nullable: true })
  notes?: string | null;

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
}
