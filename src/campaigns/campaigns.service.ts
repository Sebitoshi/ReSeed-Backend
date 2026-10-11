import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign, CampaignStatus } from './entities/campaign.entity.js';
import type { CreateCampaignDto, ListCampaignsDto, UpdateCampaignDto } from './dto/campaign.dto.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { renderPlainText, templates } from '../notifications/templates.js';

export interface CampaignView {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string;
  imageUrl: string | null;
  /** Meta en centavos convertida a entero (bigint llega como string). */
  goalCents: number | null;
  donationUrl: string | null;
  status: CampaignStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly repo: Repository<Campaign>,
    private readonly notifications: NotificationsService,
  ) {}

  private appUrl(): string {
    return process.env.APP_URL ?? 'http://localhost:3000';
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede gestionar campanas');
    }
  }

  /** Vigente = dentro de sus fechas (si tiene) y no vencida. */
  private computeIsActive(c: Campaign): boolean {
    const now = Date.now();
    if (c.startsAt && new Date(c.startsAt).getTime() > now) return false;
    if (c.endsAt && new Date(c.endsAt).getTime() < now) return false;
    return true;
  }

  toView(c: Campaign): CampaignView {
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      summary: c.summary ?? null,
      description: c.description,
      imageUrl: c.imageUrl ?? null,
      goalCents: c.goalCents == null ? null : Number(c.goalCents),
      donationUrl: c.donationUrl ?? null,
      status: c.status,
      startsAt: c.startsAt ?? null,
      endsAt: c.endsAt ?? null,
      isActive: this.computeIsActive(c),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'campana';
    let candidate = base;
    let n = 1;
    while (await this.repo.exists({ where: { slug: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  private validateDates(dto: { startsAt?: string; endsAt?: string }) {
    if (dto.startsAt && dto.endsAt && new Date(dto.startsAt) >= new Date(dto.endsAt)) {
      throw new BadRequestException('startsAt debe ser anterior a endsAt');
    }
  }

  // ---------- Admin ----------

  async create(user: AuthUser, dto: CreateCampaignDto): Promise<CampaignView> {
    this.assertAdmin(user);
    this.validateDates(dto);
    const saved = await this.repo.save(
      this.repo.create({
        title: dto.title.trim(),
        slug: await this.uniqueSlug(dto.title),
        summary: dto.summary ?? null,
        description: dto.description,
        imageUrl: dto.imageUrl ?? null,
        goalCents: dto.goalCents != null ? String(dto.goalCents) : null,
        donationUrl: dto.donationUrl ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: CampaignStatus.DRAFT,
        createdBy: user.userId,
      }),
    );
    return this.toView(saved);
  }

  async update(id: string, user: AuthUser, dto: UpdateCampaignDto): Promise<CampaignView> {
    this.assertAdmin(user);
    const c = await this.findOne(id);
    this.validateDates(dto);
    if (dto.title !== undefined && dto.title !== c.title) {
      c.title = dto.title.trim();
      c.slug = await this.uniqueSlug(dto.title);
    }
    if (dto.summary !== undefined) c.summary = dto.summary;
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.imageUrl !== undefined) c.imageUrl = dto.imageUrl;
    if (dto.goalCents !== undefined) c.goalCents = String(dto.goalCents);
    if (dto.donationUrl !== undefined) c.donationUrl = dto.donationUrl;
    if (dto.startsAt !== undefined) c.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) c.endsAt = new Date(dto.endsAt);
    return this.toView(await this.repo.save(c));
  }

  async list(user: AuthUser, q: ListCampaignsDto): Promise<Paginated<CampaignView>> {
    this.assertAdmin(user);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.repo.createQueryBuilder('c');
    if (q.status) qb.andWhere('c.status = :status', { status: q.status });
    const [items, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: items.map((c) => this.toView(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async archived(user: AuthUser, q: ListCampaignsDto): Promise<Paginated<CampaignView>> {
    this.assertAdmin(user);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const [items, total] = await this.repo
      .createQueryBuilder('c')
      .withDeleted()
      .where('c.deletedAt IS NOT NULL')
      .orderBy('c.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: items.map((c) => this.toView(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async findOne(id: string): Promise<Campaign> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Campana no encontrada');
    return c;
  }

  async viewAdmin(id: string, user: AuthUser): Promise<CampaignView> {
    this.assertAdmin(user);
    return this.toView(await this.findOne(id));
  }

  async publish(id: string, user: AuthUser): Promise<CampaignView> {
    this.assertAdmin(user);
    const c = await this.findOne(id);
    c.status = CampaignStatus.ACTIVE;
    return this.toView(await this.repo.save(c));
  }

  async close(id: string, user: AuthUser): Promise<CampaignView> {
    this.assertAdmin(user);
    const c = await this.findOne(id);
    c.status = CampaignStatus.CLOSED;
    return this.toView(await this.repo.save(c));
  }

  /** Archivado logico: no borra el registro, lo saca del listado publico. */
  async archive(id: string, user: AuthUser): Promise<void> {
    this.assertAdmin(user);
    const c = await this.findOne(id);
    await this.repo.softRemove(c);
  }

  async restore(id: string, user: AuthUser): Promise<CampaignView> {
    this.assertAdmin(user);
    const c = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!c) throw new NotFoundException('Campana no encontrada');
    if (!c.deletedAt) throw new BadRequestException('La campana no esta archivada');
    await this.repo.recover(c);
    return this.toView(c);
  }

  // ---------- Publico ----------

  async listPublic(q: ListCampaignsDto): Promise<Paginated<CampaignView>> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const [items, total] = await this.repo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: CampaignStatus.ACTIVE })
      .orderBy('c.startsAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: items.map((c) => this.toView(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBySlug(slug: string): Promise<CampaignView> {
    const c = await this.repo.findOne({ where: { slug, status: CampaignStatus.ACTIVE } });
    if (!c) throw new NotFoundException('Campana no encontrada');
    return this.toView(c);
  }

  // ---------- Difusion ----------

  /**
   * Envia la campana a todos los usuarios activos. Best-effort por destinatario:
   * un fallo de SMTP no detiene el resto ni rompe la peticion.
   */
  async notifyAll(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const c = await this.findOne(id);
    const url = `${this.appUrl()}/campanas/${c.slug}`;
    const result = await this.notifications.broadcastToAllUsers(
      (u) =>
        templates.campana(
          u.name,
          c.title,
          c.summary?.trim() ? c.summary : c.description.slice(0, 400),
          this.formatRange(c),
          url,
        ),
      NotificationType.CAMPANA,
      { referenceType: 'campaign', referenceId: c.id },
    );
    this.logger.log(
      `Campana "${c.title}" difundida por ${user.email}: ${result.enviadas}/${result.total} enviadas`,
    );
    return { campana: c.title, ...result, vistaPrevia: renderPlainText(templates.campana('', c.title, c.description, this.formatRange(c), url)) };
  }

  private formatRange(c: Campaign): string | null {
    if (!c.startsAt && !c.endsAt) return null;
    const fmt = (d: Date) => new Date(d).toLocaleDateString('es-CO');
    if (c.startsAt && c.endsAt) return `${fmt(c.startsAt)} - ${fmt(c.endsAt)}`;
    return c.startsAt ? `Desde ${fmt(c.startsAt)}` : `Hasta ${fmt(c.endsAt!)}`;
  }
}
