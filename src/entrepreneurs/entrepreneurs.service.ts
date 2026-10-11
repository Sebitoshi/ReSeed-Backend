import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Entrepreneur,
  EntrepreneurStatus,
} from './entities/entrepreneur.entity.js';
import type {
  DirectoryQueryDto,
  AdminReviewListQueryDto,
  PaginationDto,
} from './dto/list-query.dto.js';
import type {
  CreateEntrepreneurDto,
  ReviewActionDto,
  UpdateEntrepreneurDto,
} from './dto/entrepreneur.dto.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { EntrepreneurStatusLogService } from './entrepreneur-status-log.service.js';
import { DEFAULT_PAGE_SIZE } from './dto/list-query.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { templates } from '../notifications/templates.js';
import { UsersService } from '../users/users.service.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Campos que ve el publico (sin datos de representante).
export interface PublicEntrepreneur {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string | null;
  logoUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: EntrepreneurStatus;
  createdAt: Date;
}

// Lo que ve el dueño: lo publico + estado de revision y motivo.
export interface OwnerEntrepreneur extends PublicEntrepreneur {
  ownerId: string;
  reviewNote: string | null;
  updatedAt: Date;
}

function paginate(repo: Repository<Entrepreneur>): (
  qb: ReturnType<Repository<Entrepreneur>['createQueryBuilder']>,
  q: PaginationDto,
) => Promise<Paginated<Entrepreneur>> {
  return async (qb, q) => {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? DEFAULT_PAGE_SIZE));
    const [items, total] = await qb
      .orderBy('e.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  };
}

@Injectable()
export class EntrepreneursService {
  constructor(
    @InjectRepository(Entrepreneur)
    private readonly repo: Repository<Entrepreneur>,
    private readonly statusLog: EntrepreneurStatusLogService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  private toPublic(e: Entrepreneur): PublicEntrepreneur {
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      description: e.description,
      category: e.category ?? null,
      logoUrl: e.logoUrl ?? null,
      contactPhone: e.contactPhone ?? null,
      contactEmail: e.contactEmail ?? null,
      status: e.status,
      createdAt: e.createdAt,
    };
  }

  private toOwnerView(e: Entrepreneur): OwnerEntrepreneur {
    return {
      ...this.toPublic(e),
      ownerId: e.ownerId,
      reviewNote: e.reviewNote ?? null,
      updatedAt: e.updatedAt,
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'emprendimiento';
    let candidate = base;
    let n = 1;
    while (await this.repo.exists({ where: { slug: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  /** Solicitud de publicacion: cualquier usuario autenticado. */
  async submit(owner: AuthUser, dto: CreateEntrepreneurDto): Promise<OwnerEntrepreneur> {
    const entity = this.repo.create({
      ...dto,
      slug: await this.uniqueSlug(dto.name),
      status: EntrepreneurStatus.PENDING,
      ownerId: owner.userId,
    });
    const saved = await this.repo.save(entity);
    await this.statusLog.record(saved.id, EntrepreneurStatus.PENDING, this.actor(owner));
    return this.toOwnerView(saved);
  }

  /** Directorio publico: solo aprobados, con paginacion, filtro por categoria y busqueda q. */
  async findApproved(q: DirectoryQueryDto): Promise<Paginated<PublicEntrepreneur>> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: EntrepreneurStatus.APPROVED });

    if (q.categoria) {
      qb.andWhere('LOWER(e.category) = LOWER(:categoria)', { categoria: q.categoria });
    }
    if (q.q) {
      const term = `%${q.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(e.name) LIKE :term OR LOWER(e.description) LIKE :term)', {
        term,
      });
    }

    const page = await paginate(this.repo)(qb, q);
    return {
      ...page,
      items: page.items.map((e) => this.toPublic(e)),
    };
  }

  /** Perfil publico por slug; 404 si no esta aprobado. */
  async findApprovedBySlug(slug: string): Promise<PublicEntrepreneur> {
    const e = await this.repo.findOne({
      where: { slug, status: EntrepreneurStatus.APPROVED },
    });
    if (!e) throw new NotFoundException('Emprendimiento no encontrado');
    return this.toPublic(e);
  }

  private actor(user: AuthUser) {
    return { id: user.userId, role: user.role };
  }

  private async findOne(id: string): Promise<Entrepreneur> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Emprendimiento no encontrado');
    return e;
  }

  /** Vista del dueño (o admin) sobre su solicitud/emprendimiento. */
  async viewAs(id: string, user: AuthUser): Promise<OwnerEntrepreneur> {
    const e = await this.findOne(id);
    if (user.role !== UserRole.ADMIN && e.ownerId !== user.userId) {
      throw new ForbiddenException('No es tu emprendimiento');
    }
    return this.toOwnerView(e);
  }

  async listMine(ownerId: string, q: PaginationDto): Promise<Paginated<OwnerEntrepreneur>> {
    const page = await paginate(this.repo)(
      this.repo
        .createQueryBuilder('e')
        .where('e.ownerId = :ownerId', { ownerId }),
      q,
    );
    return {
      ...page,
      items: page.items.map((e) => this.toOwnerView(e)),
    };
  }

  /** Edicion: el dueño edita contenido; el admin puede todo. */
  async update(id: string, user: AuthUser, dto: UpdateEntrepreneurDto) {
    const e = await this.findOne(id);
    const isOwner = e.ownerId === user.userId;
    if (!isOwner && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No es tu emprendimiento');
    }

    if (dto.name !== undefined && dto.name !== e.name) {
      e.slug = await this.uniqueSlug(dto.name);
      e.name = dto.name.trim();
    }
    if (dto.description !== undefined) e.description = dto.description;
    if (dto.category !== undefined) e.category = dto.category;
    if (dto.logoUrl !== undefined) e.logoUrl = dto.logoUrl;
    if (dto.contactPhone !== undefined) e.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) e.contactEmail = dto.contactEmail;
    return this.toOwnerView(await this.repo.save(e));
  }

  // --- Revision (solo admin) ---

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede revisar');
    }
  }

  /**
   * Avisa al dueño el resultado de la revision. Es fire-and-forget: nunca
   * interrumpe la transicion de estado si el correo falla.
   */
  private async notifyOwner(
    ownerId: string,
    e: Entrepreneur,
    accion: 'aprobado' | 'rechazado' | 'suspendido',
    note: string | null,
  ): Promise<void> {
    try {
      const owner = await this.users.findById(ownerId);
      if (!owner) return;
      await this.notifications.notifyUser(
        ownerId,
        NotificationType.EMPRENDIMIENTO,
        templates.emprendimientoRevisado(
          owner.name,
          e.name,
          accion,
          note,
          process.env.APP_URL ?? 'http://localhost:3000',
        ),
        { referenceType: 'entrepreneur', referenceId: e.id },
      );
    } catch {
      // El estado ya quedo registrado; el correo es best-effort.
    }
  }

  async approve(id: string, user: AuthUser, dto: ReviewActionDto) {
    this.assertAdmin(user);
    const e = await this.findOne(id);
    e.status = EntrepreneurStatus.APPROVED;
    e.reviewNote = dto.note ?? null;
    const saved = await this.repo.save(e);
    await this.statusLog.record(e.id, EntrepreneurStatus.APPROVED, this.actor(user), dto.note);
    await this.notifyOwner(e.ownerId, e, 'aprobado', dto.note ?? null);
    return this.toOwnerView(saved);
  }

  async reject(id: string, user: AuthUser, dto: ReviewActionDto) {
    this.assertAdmin(user);
    if (!dto.note?.trim()) {
      throw new BadRequestException('Se requiere un motivo (note) para rechazar');
    }
    const e = await this.findOne(id);
    if (e.status === EntrepreneurStatus.APPROVED) {
      throw new BadRequestException(
        'No se puede rechazar un emprendimiento aprobado; suspéndelo en su lugar',
      );
    }
    e.status = EntrepreneurStatus.REJECTED;
    e.reviewNote = dto.note;
    const saved = await this.repo.save(e);
    await this.statusLog.record(e.id, EntrepreneurStatus.REJECTED, this.actor(user), dto.note);
    await this.notifyOwner(e.ownerId, e, 'rechazado', dto.note);
    return this.toOwnerView(saved);
  }

  async suspend(id: string, user: AuthUser, dto: ReviewActionDto) {
    this.assertAdmin(user);
    if (!dto.note?.trim()) {
      throw new BadRequestException('Se requiere un motivo (note) para suspender');
    }
    const e = await this.findOne(id);
    e.status = EntrepreneurStatus.SUSPENDED;
    e.reviewNote = dto.note;
    const saved = await this.repo.save(e);
    await this.statusLog.record(e.id, EntrepreneurStatus.SUSPENDED, this.actor(user), dto.note);
    await this.notifyOwner(e.ownerId, e, 'suspendido', dto.note);
    return this.toOwnerView(saved);
  }

  /** Reactiva un suspendido (o reintenta tras revision): vuelve a pendiente. */
  async resubmit(id: string, user: AuthUser) {
    const e = await this.findOne(id);
    if (e.ownerId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('No es tu emprendimiento');
    }
    if (e.status !== EntrepreneurStatus.REJECTED && e.status !== EntrepreneurStatus.SUSPENDED) {
      throw new BadRequestException('Solo se puede reenviar un emprendimiento rechazado o suspendido');
    }
    e.status = EntrepreneurStatus.PENDING;
    e.reviewNote = null;
    const saved = await this.repo.save(e);
    await this.statusLog.record(e.id, EntrepreneurStatus.PENDING, this.actor(user));
    return this.toOwnerView(saved);
  }

  /** Cola y filtros para el panel admin, con paginacion. */
  async adminList(q: AdminReviewListQueryDto, user: AuthUser): Promise<Paginated<OwnerEntrepreneur>> {
    this.assertAdmin(user);
    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoin('e.owner', 'owner')
      .where('1=1');
    if (q.status) qb.andWhere('e.status = :status', { status: q.status });
    if (q.ownerId) qb.andWhere('e.ownerId = :ownerId', { ownerId: q.ownerId });

    const page = await paginate(this.repo)(qb, q);
    return {
      ...page,
      items: page.items.map((e) => this.toOwnerView(e)),
    };
  }

  /** Archivado (soft-delete) solo admin; el registro queda para restaurar. */
  async remove(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const e = await this.findOne(id);
    await this.repo.softRemove(e);
    await this.statusLog.record(e.id, e.status, this.actor(user), 'Ficha archivada');
  }

  /** Restaurar una ficha archivada (admin). */
  async restore(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const e = await this.repo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!e) throw new NotFoundException('Emprendimiento no encontrado');
    if (!e.deletedAt) throw new BadRequestException('La ficha no esta archivada');
    await this.repo.recover(e);
    await this.statusLog.record(e.id, e.status, this.actor(user), 'Ficha restaurada');
    return this.toOwnerView(e);
  }

  /** Listar fichas archivadas (admin). */
  async listArchived(user: AuthUser, q: PaginationDto): Promise<Paginated<OwnerEntrepreneur>> {
    this.assertAdmin(user);
    const page = await paginate(this.repo)(
      this.repo.createQueryBuilder('e').withDeleted().where('e.deletedAt IS NOT NULL'),
      q,
    );
    return {
      ...page,
      items: page.items.map((e) => this.toOwnerView(e)),
    };
  }

  /** Historial de auditoria de una ficha (dueño o admin). */
  async history(id: string, user: AuthUser) {
    const e = await this.findOne(id);
    if (user.role !== UserRole.ADMIN && e.ownerId !== user.userId) {
      throw new ForbiddenException('No es tu emprendimiento');
    }
    return this.statusLog.history(id);
  }
}
