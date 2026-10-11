import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity.js';
import { Entrepreneur, EntrepreneurStatus } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { EntrepreneurStatusLog } from '../entrepreneurs/entities/entrepreneur-status-log.entity.js';
import { Product, ProductStatus } from '../products/entities/product.entity.js';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity.js';
import { Refund } from '../payments/entities/refund.entity.js';
import { Campaign, CampaignStatus } from '../campaigns/entities/campaign.entity.js';
import {
  SignupStatus,
  VolunteerActivity,
  VolunteerSignup,
  VolunteerStatus,
} from '../volunteer/entities/volunteer.entity.js';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from '../notifications/entities/notification.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Money } from '../payments/payments.service.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import type {
  BroadcastNotificationDto,
  ChangeRoleDto,
  ChangeUserStatusDto,
  ListModerationProductsDto,
  ListUsersDto,
  ReportRangeDto,
} from './dto/admin.dto.js';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  bio: string | null;
  phone: string | null;
  isActive: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
}

interface Range {
  from: Date;
  to: Date;
  tz: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Entrepreneur) private readonly entrepreneurs: Repository<Entrepreneur>,
    @InjectRepository(EntrepreneurStatusLog)
    private readonly entrepreneurLogs: Repository<EntrepreneurStatusLog>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Refund) private readonly refunds: Repository<Refund>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(VolunteerActivity) private readonly activities: Repository<VolunteerActivity>,
    @InjectRepository(VolunteerSignup) private readonly signups: Repository<VolunteerSignup>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador');
    }
  }

  private toAdminUser(u: User): AdminUserView {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      bio: u.bio ?? null,
      phone: u.phone ?? null,
      isActive: u.isActive,
      deactivatedAt: u.deactivatedAt ?? null,
      createdAt: u.createdAt,
    };
  }

  // ---------- Panel ----------

  /** Contadores del panel: una sola llamada para pintar el dashboard. */
  async overview(): Promise<Record<string, unknown>> {
    const [usersTotal, activeUsers, admins, entrepreneursTotal, pending, approved, productsTotal, published] =
      await Promise.all([
        this.users.count(),
        this.users.count({ where: { isActive: true } }),
        this.users.count({ where: { role: UserRole.ADMIN } }),
        this.entrepreneurs.count(),
        this.entrepreneurs.count({ where: { status: EntrepreneurStatus.PENDING } }),
        this.entrepreneurs.count({ where: { status: EntrepreneurStatus.APPROVED } }),
        this.products.count(),
        this.products.count({ where: { status: ProductStatus.PUBLISHED } }),
      ]);

    const [campaigns, activeCampaigns, activities, openActivities, signups, pendingSignups] =
      await Promise.all([
        this.campaigns.count(),
        this.campaigns.count({ where: { status: CampaignStatus.ACTIVE } }),
        this.activities.count(),
        this.activities.count({ where: { status: VolunteerStatus.OPEN } }),
        this.signups.count(),
        this.signups.count({ where: { status: SignupStatus.PENDING } }),
      ]);

    const [sent, failed] = await Promise.all([
      this.notifications.count({ where: { status: NotificationStatus.ENVIADA } }),
      this.notifications.count({ where: { status: NotificationStatus.FALLIDA } }),
    ]);

    const revenue = await this.payments
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amountCents), 0)', 'total')
      .where('p.status = :status', { status: PaymentStatus.APPROVED })
      .getRawOne<{ total: string }>();

    const refundsTotal = await this.refunds
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amountCents), 0)', 'total')
      .getRawOne<{ total: string }>();

    return {
      usuarios: { total: usersTotal, activos: activeUsers, admins },
      emprendimientos: { total: entrepreneursTotal, pendientes: pending, aprobados: approved },
      productos: { total: productsTotal, publicados: published },
      campanas: { total: campaigns, activas: activeCampaigns },
      voluntariados: { total: activities, abiertas: openActivities },
      inscripciones: { total: signups, pendientes: pendingSignups },
      notificaciones: { enviadas: sent, fallidas: failed },
      dinero: {
        ingresosAprobados: Money.centsToDecimalString(Number(revenue?.total ?? 0)),
        reembolsado: Money.centsToDecimalString(Number(refundsTotal?.total ?? 0)),
      },
    };
  }

  // ---------- Usuarios ----------

  async listUsers(q: ListUsersDto): Promise<Paginated<AdminUserView>> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.users.createQueryBuilder('u');
    if (q.role) qb.andWhere('u.role = :role', { role: q.role });
    if (q.isActive !== undefined) qb.andWhere('u.isActive = :isActive', { isActive: q.isActive });
    if (q.q) {
      const term = `%${q.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(u.name) LIKE :term OR LOWER(u.email) LIKE :term)', { term });
    }
    const [rows, total] = await qb
      .orderBy('u.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: rows.map((u) => this.toAdminUser(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string): Promise<AdminUserView & { actividad: Record<string, number> }> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    const [entrepreneurs, products, payments, signups, notifications] = await Promise.all([
      this.entrepreneurs.count({ where: { ownerId: id } }),
      this.products
        .createQueryBuilder('p')
        .innerJoin('p.entrepreneur', 'e', 'e.ownerId = :id', { id })
        .getCount(),
      this.payments.count({ where: { payerUserId: id } }),
      this.signups.count({ where: { userId: id } }),
      this.notifications.count({ where: { userId: id } }),
    ]);
    return {
      ...this.toAdminUser(u),
      actividad: { entrepreneurs, products, payments, signups, notifications },
    };
  }

  /** Cambia el rol. El admin no puede degradarse a si mismo (evita quedarse fuera). */
  async changeRole(id: string, dto: ChangeRoleDto, actor: AuthUser): Promise<AdminUserView> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if (u.id === actor.userId && u.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException('No puedes quitar tu propio rol de administrador');
    }
    if (u.role === dto.role) return this.toAdminUser(u);
    u.role = dto.role;
    const saved = await this.users.save(u);
    await this.notifyRoleChange(saved, actor);
    return this.toAdminUser(saved);
  }

  private async notifyRoleChange(u: User, actor: AuthUser): Promise<void> {
    try {
      await this.notificationsService.notifyUser(u.id, NotificationType.SISTEMA, {
        title: 'Tu rol en Reseed cambio',
        greeting: `Hola ${u.name},`,
        paragraphs: [
          `El equipo de Reseed actualizo tu rol a "${u.role}".`,
          'Si no esperabas este cambio, responde a este correo o contacta al administrador.',
        ],
        details: [
          { label: 'Nuevo rol', value: u.role },
          { label: 'Gestionado por', value: actor.email },
        ],
      });
    } catch {
      // Best-effort.
    }
  }

  /** Desactiva o reactiva una cuenta. Desactivada: no puede loguear ni usar JWT. */
  async changeUserStatus(
    id: string,
    dto: ChangeUserStatusDto,
    actor: AuthUser,
  ): Promise<AdminUserView> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if (u.id === actor.userId && !dto.isActive) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    u.isActive = dto.isActive;
    u.deactivatedAt = dto.isActive ? null : new Date();
    const saved = await this.users.save(u);
    try {
      await this.notificationsService.notifyUser(saved.id, NotificationType.SISTEMA, {
        title: dto.isActive ? 'Tu cuenta fue reactivada' : 'Tu cuenta fue desactivada',
        greeting: `Hola ${saved.name},`,
        paragraphs: [
          dto.isActive
            ? 'Ya puedes volver a usar tu cuenta normalmente.'
            : 'Tu cuenta quedo desactivada y no podras iniciar sesion mientras este asi.',
        ],
        details: [
          ...(dto.reason ? [{ label: 'Motivo', value: dto.reason }] : []),
          { label: 'Gestionado por', value: actor.email },
        ],
      });
    } catch {
      // Best-effort.
    }
    return this.toAdminUser(saved);
  }

  // ---------- Moderacion de productos ----------

  async moderationProducts(
    q: ListModerationProductsDto,
  ): Promise<Paginated<Record<string, unknown>>> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.entrepreneur', 'e')
      .leftJoinAndSelect('p.category', 'c')
      .withDeleted();
    if (q.includeArchived) qb.andWhere('1=1');
    else qb.andWhere('p.deletedAt IS NULL');
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.q) {
      const term = `%${q.q.toLowerCase()}%`;
      qb.andWhere('(LOWER(p.name) LIKE :term OR LOWER(p.description) LIKE :term)', { term });
    }
    const [rows, total] = await qb
      .orderBy('p.updatedAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        price: Money.centsToDecimalString(p.priceCents),
        status: p.status,
        isActive: p.isActive,
        archived: Boolean(p.deletedAt),
        categoryName: p.category?.name ?? null,
        entrepreneur: p.entrepreneur
          ? { id: p.entrepreneur.id, name: p.entrepreneur.name, ownerId: p.entrepreneur.ownerId }
          : null,
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Saca del catalogo un producto que no pasa la moderacion. */
  async unpublishProduct(id: string): Promise<{ id: string; status: ProductStatus }> {
    const p = await this.products.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (p.status === ProductStatus.PUBLISHED) {
      p.status = ProductStatus.UNPUBLISHED;
      await this.products.save(p);
    }
    return { id: p.id, status: p.status };
  }

  async restoreProduct(id: string) {
    const p = await this.products.findOne({ where: { id }, withDeleted: true });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (!p.deletedAt) throw new BadRequestException('El producto no esta archivado');
    await this.products.recover(p);
    return { id: p.id, restaurado: true };
  }

  // ---------- Reportes ----------

  private range(q: ReportRangeDto): Range {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 24 * 3600 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Fechas invalidas: usa formato ISO 8601');
    }
    if (from > to) throw new BadRequestException('from debe ser anterior a to');
    return { from, to, tz: q.tz ?? 'America/Bogota' };
  }

  /** Serie diaria generica: cuenta registros por dia dentro del rango. */
  private async daily(
    table: string,
    r: Range,
    extraWhere = '',
  ): Promise<Array<{ day: string; total: number }>> {
    const rows = await this.users.query(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE $3), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS total
         FROM ${table}
        WHERE created_at >= $1 AND created_at <= $2 ${extraWhere}
        GROUP BY 1
        ORDER BY 1 ASC`,
      [r.from, r.to, r.tz],
    );
    return rows.map((row: { day: string; total: number }) => ({
      day: row.day,
      total: Number(row.total),
    }));
  }

  async reportUsers(q: ReportRangeDto) {
    const r = this.range(q);
    const porDia = await this.daily('users', r);
    const porRol = await this.users
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'total')
      .where('u.createdAt >= :from AND u.createdAt <= :to', { from: r.from, to: r.to })
      .groupBy('u.role')
      .getRawMany<{ role: UserRole; total: string }>();
    const total = porRol.reduce((acc, row) => acc + Number(row.total), 0);
    return {
      rango: { from: r.from, to: r.to, tz: r.tz },
      total,
      porDia,
      porRol: porRol.map((row) => ({
        role: row.role,
        total: Number(row.total),
        porcentaje: total ? Math.round((Number(row.total) / total) * 100) : 0,
      })),
    };
  }

  async reportEntrepreneurs(q: ReportRangeDto) {
    const r = this.range(q);
    const porDia = await this.daily('entrepreneurs', r);
    const porEstado = await this.entrepreneurs
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('e.createdAt >= :from AND e.createdAt <= :to', { from: r.from, to: r.to })
      .groupBy('e.status')
      .getRawMany<{ status: EntrepreneurStatus; total: string }>();

    const revisiones = await this.entrepreneurLogs
      .createQueryBuilder('l')
      .select('l.toStatus', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('l.createdAt >= :from AND l.createdAt <= :to', { from: r.from, to: r.to })
      .groupBy('l.toStatus')
      .getRawMany<{ status: EntrepreneurStatus; total: string }>();

    return {
      rango: { from: r.from, to: r.to, tz: r.tz },
      porDia,
      porEstado: porEstado.map((row) => ({ status: row.status, total: Number(row.total) })),
      revisiones: revisiones.map((row) => ({ status: row.status, total: Number(row.total) })),
    };
  }

  async reportPayments(q: ReportRangeDto) {
    const r = this.range(q);
    const porDia = await this.daily('payments', r);

    const porEstado = await this.payments
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(p.amountCents), 0)', 'monto')
      .where('p.createdAt >= :from AND p.createdAt <= :to', { from: r.from, to: r.to })
      .groupBy('p.status')
      .getRawMany<{ status: PaymentStatus; total: string; monto: string }>();

    const topEmprendimientos = await this.payments
      .createQueryBuilder('p')
      .innerJoin('p.entrepreneur', 'e')
      .select('e.name', 'emprendimiento')
      .addSelect('COUNT(*)', 'pagos')
      .addSelect('COALESCE(SUM(p.amountCents), 0)', 'monto')
      .where('p.status = :status', { status: PaymentStatus.APPROVED })
      .andWhere('p.createdAt >= :from AND p.createdAt <= :to', { from: r.from, to: r.to })
      .groupBy('e.name')
      .orderBy('SUM(p.amountCents)', 'DESC')
      .limit(10)
      .getRawMany<{ emprendimiento: string; pagos: string; monto: string }>();

    return {
      rango: { from: r.from, to: r.to, tz: r.tz },
      porDia,
      porEstado: porEstado.map((row) => ({
        status: row.status,
        total: Number(row.total),
        monto: Money.centsToDecimalString(Number(row.monto)),
      })),
      topEmprendimientos: topEmprendimientos.map((row) => ({
        emprendimiento: row.emprendimiento,
        pagos: Number(row.pagos),
        monto: Money.centsToDecimalString(Number(row.monto)),
      })),
    };
  }

  async reportActivity(q: ReportRangeDto) {
    const r = this.range(q);
    const [usuarios, emprendimientos, productos, pagos, inscripciones, notificaciones] =
      await Promise.all([
        this.daily('users', r),
        this.daily('entrepreneurs', r),
        this.daily('products', r),
        this.daily('payments', r),
        this.daily('volunteer_signups', r),
        this.daily('notifications', r),
      ]);
    return {
      rango: { from: r.from, to: r.to, tz: r.tz },
      series: {
        usuarios,
        emprendimientos,
        productos,
        pagos,
        inscripciones,
        notificaciones,
      },
    };
  }

  async reportVolunteer(q: ReportRangeDto) {
    const r = this.range(q);
    const porDia = await this.daily('volunteer_signups', r);
    const porEstado = await this.signups
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('s.createdAt >= :from AND s.createdAt <= :to', { from: r.from, to: r.to })
      .groupBy('s.status')
      .getRawMany<{ status: SignupStatus; total: string }>();
    const topActividades = await this.signups
      .createQueryBuilder('s')
      .innerJoin('s.activity', 'a')
      .select('a.title', 'actividad')
      .addSelect('COUNT(*)', 'inscritos')
      .where('s.createdAt >= :from AND s.createdAt <= :to', { from: r.from, to: r.to })
      .groupBy('a.title')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany<{ actividad: string; inscritos: string }>();
    return {
      rango: { from: r.from, to: r.to, tz: r.tz },
      porDia,
      porEstado: porEstado.map((row) => ({ status: row.status, total: Number(row.total) })),
      topActividades: topActividades.map((row) => ({
        actividad: row.actividad,
        inscritos: Number(row.inscritos),
      })),
    };
  }

  /** Difusion general: correo del panel a todos los usuarios activos. */
  async broadcast(dto: BroadcastNotificationDto, actor: AuthUser) {
    const result = await this.notificationsService.broadcastToAllUsers(
      (u) => ({
        title: dto.subject,
        greeting: `Hola ${u.name},`,
        paragraphs: [dto.message],
        ctaLabel: dto.link ? 'Ver mas' : undefined,
        ctaUrl: dto.link,
      }),
      NotificationType.SISTEMA,
      {},
    );
    return { asunto: dto.subject, gestionadoPor: actor.email, ...result };
  }
}
