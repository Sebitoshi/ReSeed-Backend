import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CollectionUnit,
  MaterialCollection,
  MaterialType,
  SignupStatus,
  VolunteerActivity,
  VolunteerStatus,
  VolunteerSignup,
} from './entities/volunteer.entity.js';
import type {
  CreateCollectionDto,
  CreateVolunteerDto,
  ListCollectionsDto,
  ListSignupsDto,
  ListVolunteerDto,
  UpdateCollectionDto,
  UpdateVolunteerDto,
} from './dto/volunteer.dto.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { templates } from '../notifications/templates.js';
import { UsersService } from '../users/users.service.js';

export interface VolunteerView {
  id: string;
  title: string;
  description: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  slots: number | null;
  imageUrl: string | null;
  status: VolunteerStatus;
  /** Inscripciones activas (pendientes + confirmadas); consumen cupo. */
  taken: number;
  /** Cupos restantes; null = ilimitado. */
  remaining: number | null;
  createdAt: Date;
}

export interface SignupView {
  id: string;
  activityId: string;
  activityTitle: string;
  userId: string;
  status: SignupStatus;
  note: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

/** La bandeja admin agrega los datos del voluntario (nombre y email). */
export interface AdminSignupView extends SignupView {
  volunteer: { id: string; name: string; email: string } | null;
}

/** Lo que se recolecto en una jornada y en que materia prima termino. */
export interface CollectionView {
  id: string;
  /** null si la jornada origen fue borrada definitivamente. */
  activityId: string | null;
  activityTitle: string | null;
  material: MaterialType;
  /** Entero en la unidad base: gramos si unit=kg, piezas si no. */
  quantity: number;
  unit: CollectionUnit;
  /** Cantidad legible, p.ej. "25.000 g" o "320 piezas". */
  quantityLabel: string;
  collectedAt: Date;
  /** Producto de materia prima en el que se transformo; null = sin transformar. */
  rawMaterialProductId: string | null;
  rawMaterialProductName: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
}

/** Resumen agregado por tipo de material en una ventana de fechas. */
export interface CollectionSummary {
  material: MaterialType;
  unit: CollectionUnit;
  /** Suma de las cantidades en su unidad base. */
  totalQuantity: number;
  entries: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Estados que ocupan cupo: una cancelacion o un rechazo lo liberan.
const TAKING_SLOT: SignupStatus[] = [SignupStatus.PENDING, SignupStatus.CONFIRMED];

@Injectable()
export class VolunteerService {
  private readonly logger = new Logger(VolunteerService.name);

  constructor(
    @InjectRepository(VolunteerActivity)
    private readonly repo: Repository<VolunteerActivity>,
    @InjectRepository(VolunteerSignup)
    private readonly signups: Repository<VolunteerSignup>,
    @InjectRepository(MaterialCollection)
    private readonly collections: Repository<MaterialCollection>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  private appUrl(): string {
    return process.env.APP_URL ?? 'http://localhost:3000';
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede gestionar voluntariados');
    }
  }

  private async taken(activityId: string): Promise<number> {
    return this.signups.count({ where: { activityId, status: In(TAKING_SLOT) } });
  }

  async toView(a: VolunteerActivity): Promise<VolunteerView> {
    const taken = await this.taken(a.id);
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      location: a.location ?? null,
      startsAt: a.startsAt,
      endsAt: a.endsAt ?? null,
      slots: a.slots ?? null,
      imageUrl: a.imageUrl ?? null,
      status: a.status,
      taken,
      remaining: a.slots == null ? null : Math.max(0, a.slots - taken),
      createdAt: a.createdAt,
    };
  }

  private toSignupView(s: VolunteerSignup): SignupView {
    return {
      id: s.id,
      activityId: s.activityId,
      activityTitle: s.activity?.title ?? '',
      userId: s.userId,
      status: s.status,
      note: s.note ?? null,
      confirmedAt: s.confirmedAt ?? null,
      createdAt: s.createdAt,
    };
  }

  private async findOne(id: string): Promise<VolunteerActivity> {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Voluntariado no encontrado');
    return a;
  }

  // ---------- Publico ----------

  async listPublic(q: ListVolunteerDto): Promise<Paginated<VolunteerView>> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const [rows, total] = await this.repo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: VolunteerStatus.OPEN })
      .orderBy('a.startsAt', 'ASC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    const items: VolunteerView[] = [];
    for (const a of rows) items.push(await this.toView(a));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async viewPublic(id: string): Promise<VolunteerView> {
    const a = await this.findOne(id);
    if (a.status === VolunteerStatus.DRAFT) {
      throw new NotFoundException('Voluntariado no encontrado');
    }
    return this.toView(a);
  }

  // ---------- Usuario autenticado ----------

  /** Inscripcion: queda "pendiente" hasta que un admin la confirme. */
  async signup(userId: string, activityId: string): Promise<SignupView> {
    const a = await this.findOne(activityId);
    if (a.status !== VolunteerStatus.OPEN) {
      throw new BadRequestException('Este voluntariado no esta aceptando inscripciones');
    }
    const existing = await this.signups.findOne({ where: { activityId, userId } });
    if (existing && existing.status !== SignupStatus.CANCELLED) {
      throw new ConflictException('Ya te inscribiste a este voluntariado');
    }

    const taken = await this.taken(activityId);
    if (a.slots != null && taken >= a.slots) {
      throw new BadRequestException('No quedan cupos disponibles');
    }

    const signup =
      existing ??
      this.signups.create({ activityId, userId, status: SignupStatus.PENDING, note: null });
    signup.status = SignupStatus.PENDING;
    signup.note = null;
    const saved = await this.signups.save(signup);

    try {
      const user = await this.users.findById(userId);
      await this.notifications.notifyUser(
        userId,
        NotificationType.VOLUNTARIADO,
        templates.voluntariadoInscripcion(user?.name ?? 'Hola', a.title),
        { referenceType: 'volunteer_signup', referenceId: saved.id },
      );
    } catch {
      // La inscripcion ya quedo registrada; el correo es best-effort.
    }

    // Asignamos la relacion en la misma instancia en vez de esparcir la entidad.
    saved.activity = a;
    return this.toSignupView(saved);
  }

  async cancel(userId: string, activityId: string): Promise<SignupView> {
    const signup = await this.signups.findOne({ where: { activityId, userId } });
    if (!signup) throw new NotFoundException('Inscripcion no encontrada');
    if (signup.status === SignupStatus.CONFIRMED) {
      throw new BadRequestException('Ya estas confirmado; contacta al organizador para cancelar');
    }
    signup.status = SignupStatus.CANCELLED;
    const saved = await this.signups.save(signup);
    saved.activity = await this.findOne(activityId);
    return this.toSignupView(saved);
  }

  async listMine(userId: string, q: ListVolunteerDto): Promise<Paginated<SignupView>> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const [rows, total] = await this.signups
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.activity', 'a')
      .where('s.userId = :userId', { userId })
      .orderBy('s.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: rows.map((s) => this.toSignupView(s)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------- Admin ----------

  async adminCreate(user: AuthUser, dto: CreateVolunteerDto): Promise<VolunteerView> {
    this.assertAdmin(user);
    const saved = await this.repo.save(
      this.repo.create({
        title: dto.title.trim(),
        description: dto.description,
        location: dto.location ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        slots: dto.slots ?? null,
        imageUrl: dto.imageUrl ?? null,
        status: VolunteerStatus.DRAFT,
        createdBy: user.userId,
      }),
    );
    return this.toView(saved);
  }

  async adminUpdate(id: string, user: AuthUser, dto: UpdateVolunteerDto): Promise<VolunteerView> {
    this.assertAdmin(user);
    const a = await this.findOne(id);
    if (dto.title !== undefined) a.title = dto.title.trim();
    if (dto.description !== undefined) a.description = dto.description;
    if (dto.location !== undefined) a.location = dto.location;
    if (dto.startsAt !== undefined) a.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) a.endsAt = new Date(dto.endsAt);
    if (dto.imageUrl !== undefined) a.imageUrl = dto.imageUrl;
    if (dto.slots !== undefined) {
      const taken = await this.taken(id);
      if (dto.slots < taken) {
        throw new BadRequestException(`Quedan ${taken} inscripciones activas; no bajar los cupos`);
      }
      a.slots = dto.slots;
    }
    return this.toView(await this.repo.save(a));
  }

  async adminList(user: AuthUser, q: ListVolunteerDto): Promise<Paginated<VolunteerView>> {
    this.assertAdmin(user);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.repo.createQueryBuilder('a');
    if (q.status) qb.andWhere('a.status = :status', { status: q.status });
    const [rows, total] = await qb
      .orderBy('a.startsAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    const items: VolunteerView[] = [];
    for (const a of rows) items.push(await this.toView(a));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Abre la actividad al publico. */
  async open(id: string, user: AuthUser): Promise<VolunteerView> {
    this.assertAdmin(user);
    const a = await this.findOne(id);
    a.status = VolunteerStatus.OPEN;
    return this.toView(await this.repo.save(a));
  }

  async close(id: string, user: AuthUser): Promise<VolunteerView> {
    this.assertAdmin(user);
    const a = await this.findOne(id);
    a.status = VolunteerStatus.CLOSED;
    return this.toView(await this.repo.save(a));
  }

  async finish(id: string, user: AuthUser): Promise<VolunteerView> {
    this.assertAdmin(user);
    const a = await this.findOne(id);
    a.status = VolunteerStatus.DONE;
    return this.toView(await this.repo.save(a));
  }

  async archive(id: string, user: AuthUser): Promise<void> {
    this.assertAdmin(user);
    await this.repo.softRemove(await this.findOne(id));
  }

  async restore(id: string, user: AuthUser): Promise<VolunteerView> {
    this.assertAdmin(user);
    const a = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!a) throw new NotFoundException('Voluntariado no encontrado');
    if (!a.deletedAt) throw new BadRequestException('El voluntariado no esta archivado');
    await this.repo.recover(a);
    return this.toView(a);
  }

  async adminArchived(user: AuthUser, q: ListVolunteerDto): Promise<Paginated<VolunteerView>> {
    this.assertAdmin(user);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const [rows, total] = await this.repo
      .createQueryBuilder('a')
      .withDeleted()
      .where('a.deletedAt IS NOT NULL')
      .orderBy('a.startsAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    const items: VolunteerView[] = [];
    for (const a of rows) items.push(await this.toView(a));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ---------- Bandeja de inscripciones (admin) ----------

  async signupsList(user: AuthUser, q: ListSignupsDto): Promise<Paginated<AdminSignupView>> {
    this.assertAdmin(user);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.signups
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.activity', 'a')
      .leftJoinAndSelect('s.user', 'u');
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.activityId) qb.andWhere('s.activityId = :activityId', { activityId: q.activityId });
    const [rows, total] = await qb
      .orderBy('s.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: rows.map((s): AdminSignupView => ({
        ...this.toSignupView(s),
        volunteer: s.user ? { id: s.user.id, name: s.user.name, email: s.user.email } : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async findSignup(id: string): Promise<VolunteerSignup> {
    const s = await this.signups.findOne({ where: { id }, relations: { activity: true } });
    if (!s) throw new NotFoundException('Inscripcion no encontrada');
    return s;
  }

  async confirmSignup(id: string, user: AuthUser, note?: string): Promise<SignupView> {
    this.assertAdmin(user);
    const s = await this.findSignup(id);
    if (s.status === SignupStatus.CANCELLED) {
      throw new BadRequestException('La inscripcion fue cancelada por el voluntario');
    }
    // Si hay cupo, se confirma; si no, aun asi el admin manda.
    s.status = SignupStatus.CONFIRMED;
    s.confirmedAt = new Date();
    s.note = note ?? s.note ?? null;
    const saved = await this.signups.save(s);

    try {
      const volunteer = await this.users.findById(s.userId);
      await this.notifications.notifyUser(
        s.userId,
        NotificationType.VOLUNTARIADO,
        templates.voluntariadoConfirmado(
          volunteer?.name ?? 'Hola',
          saved.activity.title,
          saved.activity.startsAt.toLocaleString('es-CO'),
          saved.activity.location ?? null,
          this.appUrl(),
        ),
        { referenceType: 'volunteer_signup', referenceId: saved.id },
      );
    } catch {
      // Best-effort.
    }
    return this.toSignupView(saved);
  }

  async rejectSignup(id: string, user: AuthUser, note?: string): Promise<SignupView> {
    this.assertAdmin(user);
    if (!note?.trim()) {
      throw new BadRequestException('Se requiere un motivo (note) para rechazar');
    }
    const s = await this.findSignup(id);
    s.status = SignupStatus.REJECTED;
    s.note = note;
    s.confirmedAt = null;
    const saved = await this.signups.save(s);

    try {
      const volunteer = await this.users.findById(s.userId);
      await this.notifications.notifyUser(
        s.userId,
        NotificationType.VOLUNTARIADO,
        templates.voluntariadoRechazado(
          volunteer?.name ?? 'Hola',
          saved.activity.title,
          note,
        ),
        { referenceType: 'volunteer_signup', referenceId: saved.id },
      );
      this.logger.log(`Inscripcion ${id} rechazada por ${user.email}`);
    } catch {
      // Best-effort.
    }
    return this.toSignupView(saved);
  }

  // ---------- Materiales recolectados ----------

  /**
   * Cantidad legible sin flotantes: para kg se hace la division con enteros
   * (25000 g -> "25 kg"), igual que con los precios en centavos.
   */
  private quantityLabel(quantity: number, unit: CollectionUnit): string {
    if (unit === CollectionUnit.KG) {
      const whole = Math.floor(quantity / 1000);
      const frac = quantity % 1000;
      if (frac === 0) return `${whole} kg`;
      return `${whole}.${String(frac).padStart(3, '0')} kg`;
    }
    if (unit === CollectionUnit.UNIDAD) return `${quantity} piezas`;
    return `${quantity} bultos`;
  }

  private toCollectionView(c: MaterialCollection): CollectionView {
    return {
      id: c.id,
      activityId: c.activityId ?? null,
      activityTitle: c.activity?.title ?? null,
      material: c.material,
      quantity: c.quantity,
      unit: c.unit,
      quantityLabel: this.quantityLabel(c.quantity, c.unit),
      collectedAt: c.collectedAt,
      rawMaterialProductId: c.rawMaterialProductId ?? null,
      rawMaterialProductName: c.rawMaterialProduct?.name ?? null,
      notes: c.notes ?? null,
      createdBy: c.createdBy ?? null,
      createdAt: c.createdAt,
    };
  }

  /** Valida que el producto de materia prima exista y no este archivado. */
  private async assertProduct(productId: string): Promise<void> {
    const p = await this.products.findOne({ where: { id: productId } });
    if (!p) {
      throw new NotFoundException('Producto de materia prima no encontrado');
    }
  }

  /**
   * Registra lo que se recolecto en una jornada. Es el eslabon inicial de la
   * traza: jornada -> material -> materia prima -> socio.
   */
  async adminCreateCollection(
    user: AuthUser,
    activityId: string,
    dto: CreateCollectionDto,
  ): Promise<CollectionView> {
    this.assertAdmin(user);
    const activity = await this.findOne(activityId);
    if (dto.rawMaterialProductId) await this.assertProduct(dto.rawMaterialProductId);

    const saved = await this.collections.save(
      this.collections.create({
        activityId: activity.id,
        material: dto.material,
        quantity: dto.quantity,
        unit: dto.unit,
        collectedAt: dto.collectedAt ? new Date(dto.collectedAt) : new Date(),
        rawMaterialProductId: dto.rawMaterialProductId ?? null,
        notes: dto.notes ?? null,
        createdBy: user.userId,
      }),
    );
    // Cargamos las relaciones para que la respuesta venga completa, igual que
    // en los listados (sino el nombre de la materia prima vuelve null).
    const full = await this.collections.findOne({
      where: { id: saved.id },
      relations: { activity: true, rawMaterialProduct: true },
    });
    return this.toCollectionView(full ?? saved);
  }

  /** Recolectados de una sola jornada (publico: transparencia del impacto). */
  async listCollectionsByActivity(activityId: string): Promise<CollectionView[]> {
    const rows = await this.collections.find({
      where: { activityId },
      relations: { activity: true, rawMaterialProduct: true },
      order: { collectedAt: 'DESC' },
    });
    return rows.map((c) => this.toCollectionView(c));
  }

  private applyCollectionFilters(qb: ReturnType<Repository<MaterialCollection>['createQueryBuilder']>, q: ListCollectionsDto) {
    if (q.material) qb.andWhere('c.material = :material', { material: q.material });
    if (q.activityId) qb.andWhere('c.activityId = :activityId', { activityId: q.activityId });
    // "none" permite ver lo que aun no se ha transformado en materia prima.
    if (q.rawMaterialProductId === 'none') {
      qb.andWhere('c.rawMaterialProductId IS NULL');
    } else if (q.rawMaterialProductId) {
      qb.andWhere('c.rawMaterialProductId = :productId', {
        productId: q.rawMaterialProductId,
      });
    }
    if (q.from) qb.andWhere('c.collectedAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('c.collectedAt <= :to', { to: new Date(q.to) });
    return qb;
  }

  async adminListCollections(
    user: AuthUser,
    q: ListCollectionsDto,
  ): Promise<Paginated<CollectionView>> {
    this.assertAdmin(user);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.collections
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.activity', 'a')
      .leftJoinAndSelect('c.rawMaterialProduct', 'p');
    this.applyCollectionFilters(qb, q);
    const [rows, total] = await qb
      .orderBy('c.collectedAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: rows.map((c) => this.toCollectionView(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateCollection(
    id: string,
    user: AuthUser,
    dto: UpdateCollectionDto,
  ): Promise<CollectionView> {
    this.assertAdmin(user);
    const c = await this.collections.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Recoleccion no encontrada');
    if (dto.rawMaterialProductId) await this.assertProduct(dto.rawMaterialProductId);

    if (dto.material !== undefined) c.material = dto.material;
    if (dto.quantity !== undefined) c.quantity = dto.quantity;
    if (dto.unit !== undefined) c.unit = dto.unit;
    if (dto.collectedAt !== undefined) c.collectedAt = new Date(dto.collectedAt);
    if (dto.rawMaterialProductId !== undefined) {
      c.rawMaterialProductId = dto.rawMaterialProductId || null;
    }
    if (dto.notes !== undefined) c.notes = dto.notes;
    await this.collections.save(c);
    const full = await this.collections.findOne({
      where: { id: c.id },
      relations: { activity: true, rawMaterialProduct: true },
    });
    return this.toCollectionView(full ?? c);
  }

  /** Desvincula la recoleccion del producto de materia prima. */
  async unlinkCollection(id: string, user: AuthUser): Promise<CollectionView> {
    this.assertAdmin(user);
    const c = await this.collections.findOne({
      where: { id },
      relations: { activity: true, rawMaterialProduct: true },
    });
    if (!c) throw new NotFoundException('Recoleccion no encontrada');
    c.rawMaterialProductId = null;
    c.rawMaterialProduct = null;
    return this.toCollectionView(await this.collections.save(c));
  }

  /** Impacto agregado por material; sirve para el panel y los reportes. */
  async collectionSummary(user: AuthUser, q: ListCollectionsDto): Promise<CollectionSummary[]> {
    this.assertAdmin(user);
    const qb = this.collections.createQueryBuilder('c').select('c.material', 'material');
    qb.addSelect('c.unit', 'unit');
    qb.addSelect('SUM(c.quantity)', 'totalQuantity');
    qb.addSelect('COUNT(c.id)', 'entries');
    this.applyCollectionFilters(qb, q);
    qb.groupBy('c.material').addGroupBy('c.unit').orderBy('material', 'ASC');
    const rows: Array<{ material: MaterialType; unit: CollectionUnit; totalQuantity: string; entries: string }> =
      await qb.getRawMany();
    return rows.map((r) => ({
      material: r.material,
      unit: r.unit,
      totalQuantity: Number(r.totalQuantity),
      entries: Number(r.entries),
    }));
  }
}
