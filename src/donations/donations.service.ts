import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donation, DonationStatus } from './entities/donation.entity.js';
import { Campaign, CampaignStatus } from '../campaigns/entities/campaign.entity.js';
import { Money, PaymentsService } from '../payments/payments.service.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { CreateDonationDto, MIN_DONATION_CENTS } from './dto/donation.dto.js';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DonationView {
  id: string;
  amountCents: number;
  amount: string;
  currencyCode: string;
  status: DonationStatus;
  message: string | null;
  anonymous: boolean;
  campaignId: string | null;
  campaignTitle: string | null;
  campaignSlug: string | null;
  paymentId: string | null;
  donorName: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
}

/** Avance de una campana con meta de recaudo. */
export interface CampaignProgress {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  imageUrl: string | null;
  goalCents: number | null;
  raisedCents: number;
  donors: number;
  endsAt: Date | null;
}

export interface DonationSummary {
  totals: { raisedCents: number; donors: number; count: number };
  general: { raisedCents: number; donors: number; count: number };
  campaigns: CampaignProgress[];
  recent: DonationView[];
}

export interface AdminDonationStats {
  total: number;
  aprobadas: number;
  pendientes: number;
  recaudado: string;
  recaudadoCents: number;
  fondoGeneral: string;
  fondoGeneralCents: number;
  porCampana: string;
  porCampanaCents: number;
  topCampanas: { campaignId: string; title: string; raisedCents: number; donors: number }[];
}

@Injectable()
export class DonationsService {
  constructor(
    @InjectRepository(Donation)
    private readonly donations: Repository<Donation>,
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    private readonly payments: PaymentsService,
  ) {}

  private toView(d: Donation): DonationView {
    return {
      id: d.id,
      amountCents: d.amountCents,
      amount: Money.centsToDecimalString(d.amountCents),
      currencyCode: d.currencyCode,
      status: d.status,
      message: d.message ?? null,
      anonymous: d.anonymous,
      campaignId: d.campaignId ?? null,
      campaignTitle: d.campaign?.title ?? null,
      campaignSlug: d.campaign?.slug ?? null,
      paymentId: d.paymentId ?? null,
      // Nunca expone el correo; el nombre solo cuando el aporte no es anonimo.
      donorName: d.anonymous ? null : (d.donor?.name ?? null),
      createdAt: d.createdAt,
      confirmedAt: d.confirmedAt ?? null,
    };
  }

  private page(q: { page?: number; limit?: number }, fallbackLimit = 12): { page: number; limit: number } {
    return {
      page: Math.max(1, q.page ?? 1),
      limit: Math.min(50, Math.max(1, q.limit ?? fallbackLimit)),
    };
  }

  // ---------- Crear aporte ----------

  /**
   * Registra la donacion y la intencion de pago que la cobra. La donacion nace
   * pendiente y copia el estado del pago: se aprueba cuando el checkout se
   * confirma (sandbox o webhook de la pasarela real).
   */
  async create(
    user: AuthUser,
    dto: CreateDonationDto,
  ): Promise<{ donation: DonationView; paymentId: string | null; checkoutUrl: string | null }> {
    const amount = Math.trunc(dto.amountCents);
    if (!Number.isFinite(amount) || amount < MIN_DONATION_CENTS) {
      throw new BadRequestException(`El aporte minimo es de ${MIN_DONATION_CENTS} centavos`);
    }

    let campaign: Campaign | null = null;
    if (dto.campaignId) {
      campaign = await this.campaigns.findOne({ where: { id: dto.campaignId } });
      if (!campaign || campaign.status === CampaignStatus.DRAFT) {
        throw new NotFoundException('Campana no encontrada');
      }
      if (campaign.status !== CampaignStatus.ACTIVE) {
        throw new BadRequestException('Esta campana ya no recibe aportes');
      }
    }

    // El monto lo pone el donante (a diferencia del catalogo, donde sale del
    // producto); el pago es la fuente del cobro y la donacion solo lo refleja.
    const checkout = await this.payments.createCheckout(user, {
      amountCents: amount,
      description: campaign
        ? `Donación a la campaña «${campaign.title}»`
        : 'Donación al fondo de Izeco',
      metadata: campaign
        ? { kind: 'donation', campaignId: campaign.id }
        : { kind: 'donation', campaignId: 'general' },
    });

    const donation = await this.donations.save(
      this.donations.create({
        donorUserId: user.userId,
        campaignId: campaign?.id ?? null,
        paymentId: checkout.payment.id,
        amountCents: amount,
        currencyCode: checkout.payment.currencyCode,
        status: DonationStatus.PENDING,
        message: dto.message?.trim() ? dto.message.trim() : null,
        anonymous: dto.anonymous ?? false,
      }),
    );

    const saved = await this.donations.findOne({
      where: { id: donation.id },
      relations: { campaign: true, donor: true },
    });
    return {
      donation: this.toView(saved ?? donation),
      paymentId: checkout.payment.id,
      checkoutUrl: checkout.checkoutUrl,
    };
  }

  // ---------- Consultas ----------

  /** Mis aportes, con el resultado del cobro. */
  async listMine(userId: string, q: { page?: number; limit?: number }): Promise<Paginated<DonationView>> {
    const { page, limit } = this.page(q);
    const [rows, total] = await this.donations.findAndCount({
      where: { donorUserId: userId },
      relations: { campaign: true, donor: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return {
      items: rows.map((d) => this.toView(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Estado publico del recaudo: totales, fondo general, avance de cada campana
   * activa y los ultimos aportes confirmados (el "muro" de la pagina).
   */
  async summary(): Promise<DonationSummary> {
    const rows = await this.donations
      .createQueryBuilder('d')
      .select('d.campaignId', 'campaignId')
      .addSelect('COALESCE(SUM(d.amountCents), 0)', 'raised')
      .addSelect('COUNT(DISTINCT d.donorUserId)', 'donors')
      .addSelect('COUNT(*)', 'count')
      .where('d.status = :status', { status: DonationStatus.APPROVED })
      .groupBy('d.campaignId')
      .getRawMany<{ campaignId: string | null; raised: string; donors: string; count: string }>();

    const generalRow = rows.find((r) => r.campaignId == null);
    const byCampaign = new Map(rows.filter((r) => r.campaignId).map((r) => [r.campaignId as string, r]));

    const totalsRow = await this.donations
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amountCents), 0)', 'raised')
      .addSelect('COUNT(DISTINCT d.donorUserId)', 'donors')
      .addSelect('COUNT(*)', 'count')
      .where('d.status = :status', { status: DonationStatus.APPROVED })
      .getRawOne<{ raised: string; donors: string; count: string }>();

    const active = await this.campaigns.find({
      where: { status: CampaignStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    const campaigns: CampaignProgress[] = active.map((c) => {
      const row = byCampaign.get(c.id);
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        summary: c.summary ?? null,
        imageUrl: c.imageUrl ?? null,
        goalCents: c.goalCents == null ? null : Number(c.goalCents),
        raisedCents: row ? Number(row.raised) : 0,
        donors: row ? Number(row.donors) : 0,
        endsAt: c.endsAt ?? null,
      };
    });

    const recentRows = await this.donations.find({
      where: { status: DonationStatus.APPROVED },
      relations: { campaign: true, donor: true },
      order: { confirmedAt: 'DESC', createdAt: 'DESC' },
      take: 6,
    });

    return {
      totals: {
        raisedCents: Number(totalsRow?.raised ?? 0),
        donors: Number(totalsRow?.donors ?? 0),
        count: Number(totalsRow?.count ?? 0),
      },
      general: {
        raisedCents: Number(generalRow?.raised ?? 0),
        donors: Number(generalRow?.donors ?? 0),
        count: Number(generalRow?.count ?? 0),
      },
      campaigns,
      recent: recentRows.map((d) => this.toView(d)),
    };
  }

  /** Listado global para el panel; incluye donante y campana. */
  async adminList(q: {
    page?: number;
    limit?: number;
    status?: DonationStatus;
  }): Promise<Paginated<DonationView>> {
    const { page, limit } = this.page(q);
    const [rows, total] = await this.donations.findAndCount({
      where: q.status ? { status: q.status } : {},
      relations: { campaign: true, donor: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return {
      items: rows.map((d) => this.toView(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Resumen para el panel: cantidades por estado y recaudo por destino. */
  async adminStats(): Promise<AdminDonationStats> {
    const statusRows = await this.donations
      .createQueryBuilder('d')
      .select('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('d.status')
      .getRawMany<{ status: DonationStatus; count: string }>();
    const countOf = (status: DonationStatus): number =>
      Number(statusRows.find((r) => r.status === status)?.count ?? 0);

    const sums = await this.donations
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amountCents), 0)', 'raised')
      .addSelect(
        'COALESCE(SUM(CASE WHEN d.campaignId IS NULL THEN d.amountCents ELSE 0 END), 0)',
        'general',
      )
      .where('d.status = :status', { status: DonationStatus.APPROVED })
      .getRawOne<{ raised: string; general: string }>();

    const top = await this.donations
      .createQueryBuilder('d')
      .select('d.campaignId', 'campaignId')
      .addSelect('c.title', 'title')
      .addSelect('COALESCE(SUM(d.amountCents), 0)', 'raised')
      .addSelect('COUNT(DISTINCT d.donorUserId)', 'donors')
      .innerJoin(Campaign, 'c', 'c.id = d.campaignId')
      .where('d.status = :status', { status: DonationStatus.APPROVED })
      .andWhere('d.campaignId IS NOT NULL')
      .groupBy('d.campaignId')
      .addGroupBy('c.title')
      .orderBy('raised', 'DESC')
      .limit(5)
      .getRawMany<{ campaignId: string; title: string; raised: string; donors: string }>();

    const raised = Number(sums?.raised ?? 0);
    const general = Number(sums?.general ?? 0);

    return {
      total: statusRows.reduce((sum, r) => sum + Number(r.count), 0),
      aprobadas: countOf(DonationStatus.APPROVED),
      pendientes: countOf(DonationStatus.PENDING),
      recaudado: Money.centsToDecimalString(raised),
      recaudadoCents: raised,
      fondoGeneral: Money.centsToDecimalString(general),
      fondoGeneralCents: general,
      porCampana: Money.centsToDecimalString(raised - general),
      porCampanaCents: raised - general,
      topCampanas: top.map((r) => ({
        campaignId: r.campaignId,
        title: r.title,
        raisedCents: Number(r.raised),
        donors: Number(r.donors),
      })),
    };
  }
}
