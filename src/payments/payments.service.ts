import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity.js';
import { Refund, RefundStatus } from './entities/refund.entity.js';
import type { GatewayProvider } from './gateway/payment-gateway.interface.js';
import { PAYMENTS_GATEWAY } from './payments.constants.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { templates } from '../notifications/templates.js';
import { UsersService } from '../users/users.service.js';

export const DEFAULT_CURRENCY = 'COP';

// Precio en centavos de pesos colombianos (el mismo criterio de products).
export class Money {
  static centsToDecimalString(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(Math.trunc(cents));
    return `${sign}${Math.floor(abs / 100)}.${`${abs % 100}`.padStart(2, '0')}`;
  }
}

export interface CreatePaymentDto {
  /** Monto en centavos de COP. */
  amountCents: number;
  currencyCode?: string;
  description?: string;
  /** Emprendimiento que cobra; en el marketplace, el dueño de la ficha. */
  entrepreneurId?: string;
  /** Metadatos libres de negocio (ej. {orderId}, {productId}). */
  metadata?: Record<string, string>;
}

export interface PublicPayment {
  id: string;
  externalRef: string;
  amountCents: number;
  amount: string;
  currencyCode: string;
  status: PaymentStatus;
  refundedAmountCents: number;
  description: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

export interface OwnerPayment extends PublicPayment {
  payerUserId: string | null;
  entrepreneurId: string | null;
}

export interface CheckoutPayload {
  payment: OwnerPayment;
  checkoutUrl: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refunds: Repository<Refund>,
    @InjectRepository(Entrepreneur)
    private readonly entrepreneurs: Repository<Entrepreneur>,
    @Inject(PAYMENTS_GATEWAY)
    private readonly gateway: GatewayProvider,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  private appUrl(): string {
    return process.env.APP_URL ?? 'http://localhost:3000';
  }

  /** Aviso al comprador; best-effort, nunca interrumpe el cobro. */
  private async notifyBuyer(
    userId: string | null,
    payment: Payment,
    kind: 'iniciado' | 'confirmado' | 'rechazado' | 'reembolso',
    motivo?: string | null,
  ): Promise<void> {
    if (!userId) return;
    try {
      const buyer = await this.users.findById(userId);
      const name = buyer?.name ?? 'Hola';
      const monto = `${Money.centsToDecimalString(payment.amountCents)} ${payment.currencyCode}`;
      const content =
        kind === 'iniciado'
          ? templates.pagoIniciado(name, monto, payment.description ?? null, this.appUrl())
          : kind === 'confirmado'
            ? templates.pagoConfirmado(name, monto, payment.description ?? null)
            : kind === 'rechazado'
              ? templates.pagoRechazado(name, monto)
              : templates.reembolsoSolicitado(
                  name,
                  `${Money.centsToDecimalString(payment.refundedAmountCents)} ${payment.currencyCode}`,
                  motivo ?? null,
                );
      await this.notifications.notifyUser(
        userId,
        kind === 'reembolso' ? NotificationType.REEMBOLSO : NotificationType.PAGO,
        content,
        { referenceType: 'payment', referenceId: payment.id },
      );
    } catch {
      // El pago ya quedo registrado; el correo es best-effort.
    }
  }

  private toPublic(p: Payment): PublicPayment {
    return {
      id: p.id,
      externalRef: p.externalRef,
      amountCents: p.amountCents,
      amount: Money.centsToDecimalString(p.amountCents),
      currencyCode: p.currencyCode,
      status: p.status,
      refundedAmountCents: p.refundedAmountCents,
      description: p.description ?? null,
      confirmedAt: p.confirmedAt ?? null,
      createdAt: p.createdAt,
    };
  }

  private toOwnerView(p: Payment): OwnerPayment {
    return {
      ...this.toPublic(p),
      payerUserId: p.payerUserId,
      entrepreneurId: p.entrepreneurId,
    };
  }

  // ---------- Crear checkout ----------

  async createCheckout(user: AuthUser, dto: CreatePaymentDto): Promise<CheckoutPayload> {
    const amount = Math.trunc(dto.amountCents);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amountCents debe ser un entero positivo');
    }
    // En un marketplace cualquier comprador puede pagar a cualquier
    // emprendimiento; solo validamos que exista.
    let entrepreneurId: string | null = null;
    if (dto.entrepreneurId) {
      const ent = await this.entrepreneurs.findOne({ where: { id: dto.entrepreneurId } });
      if (!ent) throw new NotFoundException('Emprendimiento no encontrado');
      entrepreneurId = ent.id;
    }
    const externalRef = crypto.randomUUID();
    const session = await this.gateway.createCheckout({
      amountCents: amount,
      currency: dto.currencyCode ?? DEFAULT_CURRENCY,
      description: dto.description,
      externalRef,
      metadata: dto.metadata,
    });
    const payment = await this.payments.save(
      this.payments.create({
        externalRef: session.externalRef,
        amountCents: amount,
        netAmountCents: amount,
        currencyCode: dto.currencyCode ?? DEFAULT_CURRENCY,
        status: PaymentStatus.PENDING,
        payerUserId: user.userId,
        entrepreneurId,
        refundedAmountCents: 0,
        description: dto.description ?? null,
      }),
    );
    await this.notifyBuyer(user.userId, payment, 'iniciado');
    return { payment: this.toOwnerView(payment), checkoutUrl: session.checkoutUrl };
  }

  // ---------- Webhook: confirmacion de la pasarela ----------

  /**
   * Procesa el evento y garantiza que un mismo externalRef no se procese dos
   * veces: si ya está en el estado destino, la llamada es un no-op idempotente.
   */
  async processWebhookEvent(ev: {
    externalRef: string;
    outcome: 'approved' | 'rejected' | 'cancelled' | 'refunded';
    amountCents?: number;
    refundExternalRef?: string;
  }): Promise<{ paymentId: string; status: PaymentStatus; changed: boolean }> {
    const payment = await this.payments.findOne({ where: { externalRef: ev.externalRef } });
    if (!payment) {
      // Desconocido: la pasarela nos habla de un pago que no creamos.
      throw new NotFoundException('Pago no conocido por el sistema');
    }

    if (ev.outcome === 'approved') {
      if (payment.status === PaymentStatus.APPROVED) {
        return { paymentId: payment.id, status: payment.status, changed: false }; // idempotente
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictException(
          `Pago en estado ${payment.status}; no se puede aprobar desde aqui`,
        );
      }
      if (ev.amountCents !== undefined && ev.amountCents !== payment.amountCents) {
        throw new BadRequestException('El monto confirmado no coincide con la intencion');
      }
      payment.status = PaymentStatus.APPROVED;
      payment.confirmedAt = new Date();
      await this.payments.save(payment);
      await this.notifyBuyer(payment.payerUserId, payment, 'confirmado');
      return { paymentId: payment.id, status: payment.status, changed: true };
    }

    if (ev.outcome === 'rejected') {
      if (payment.status === PaymentStatus.REJECTED) {
        return { paymentId: payment.id, status: payment.status, changed: false };
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictException(
          `Pago en estado ${payment.status}; no se puede rechazar desde aqui`,
        );
      }
      payment.status = PaymentStatus.REJECTED;
      await this.payments.save(payment);
      await this.notifyBuyer(payment.payerUserId, payment, 'rechazado');
      return { paymentId: payment.id, status: payment.status, changed: true };
    }

    if (ev.outcome === 'cancelled') {
      if (payment.status === PaymentStatus.CANCELLED) {
        return { paymentId: payment.id, status: payment.status, changed: false };
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictException(
          `Pago en estado ${payment.status}; no se puede cancelar desde aqui`,
        );
      }
      payment.status = PaymentStatus.CANCELLED;
      await this.payments.save(payment);
      return { paymentId: payment.id, status: payment.status, changed: true };
    }

    // refunded: viene de la pasarela; solo si tiene refundExternalRef.
    if (!ev.refundExternalRef) {
      throw new BadRequestException('Evento refunded sin refundExternalRef');
    }
    return this.applyRefundEvent(payment, ev.refundExternalRef);
  }

  // ---------- Refunds ----------

  private async applyRefundEvent(
    payment: Payment,
    refundExternalRef: string,
  ): Promise<{ paymentId: string; status: PaymentStatus; changed: boolean }> {
    // Idempotencia: si ya aplicamos ese refund, no-op.
    const existing = await this.refunds.findOne({ where: { externalRef: refundExternalRef } });
    if (existing) {
      return { paymentId: payment.id, status: payment.status, changed: false };
    }
    if (payment.status !== PaymentStatus.APPROVED) {
      throw new ConflictException(
        `Pago en estado ${payment.status}; solo se reembolsa uno aprobado`,
      );
    }
    // El monto lo define el registro que ya hay que crear; sin evento con monto,
    // reembolso total.
    const amount = payment.netAmountCents - payment.refundedAmountCents;
    if (amount <= 0) {
      throw new BadRequestException('Nada pendiente de reembolsar');
    }
    const refund: Refund = this.refunds.create({
      paymentId: payment.id,
      amountCents: amount,
      status: RefundStatus.APPROVED,
      externalRef: refundExternalRef,
      actorUserId: 'system',
    });
    await this.refunds.save(refund);
    payment.refundedAmountCents += amount;
    if (payment.refundedAmountCents >= payment.netAmountCents) {
      payment.status = PaymentStatus.REFUNDED;
    }
    await this.payments.save(payment);
    await this.notifyBuyer(payment.payerUserId, payment, 'reembolso');
    return { paymentId: payment.id, status: payment.status, changed: true };
  }

  /** El dueño (o admin) pide un refund a la pasarela. */
  async createRefund(
    paymentId: string,
    user: AuthUser,
    input?: { amountCents?: number; reason?: string },
  ): Promise<OwnerPayment> {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const ent = payment.entrepreneurId
      ? await this.entrepreneurs.findOne({ where: { id: payment.entrepreneurId } })
      : null;
    const isAdmin = user.role === UserRole.ADMIN;
    const isSeller = !!ent && ent.ownerId === user.userId;
    const isBuyer = payment.payerUserId === user.userId;
    if (!isAdmin && !isSeller && !isBuyer) {
      throw new ForbiddenException('No puedes reembolsar este pago');
    }
    if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException(
        `Solo se puede reembolsar un pago aprobado (estado: ${payment.status})`,
      );
    }
    const remaining = payment.netAmountCents - payment.refundedAmountCents;
    if (remaining <= 0) {
      throw new BadRequestException('El pago ya fue reembolsado totalmente');
    }
    const amount = Math.trunc(input?.amountCents ?? remaining);
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException(`amountCents fuera de rango (restante: ${remaining})`);
    }

    // Pasarela: la API del PSP nos dice si acepta.
    const gw = await this.gateway.createRefund(payment.externalRef, amount);
    // Idempotencia operativa: si ya existe ese refundExternalRef, no-op.
    const existing = await this.refunds.findOne({ where: { externalRef: gw.refundExternalRef } });
    if (existing) return this.toOwnerView(payment);

    const refund = this.refunds.create({
      paymentId: payment.id,
      amountCents: amount,
      status: RefundStatus.APPROVED,
      externalRef: gw.refundExternalRef,
      actorUserId: user.userId,
      reason: input?.reason ?? null,
    });
    await this.refunds.save(refund);

    payment.refundedAmountCents += amount;
    if (payment.refundedAmountCents >= payment.netAmountCents) {
      payment.status = PaymentStatus.REFUNDED;
    }
    await this.payments.save(payment);
    await this.notifyBuyer(payment.payerUserId, payment, 'reembolso', input?.reason ?? null);
    return this.toOwnerView(payment);
  }

  /** Refunds de un pago; solo el comprador, el vendedor o admin. */
  async listRefundsOf(paymentId: string, user: AuthUser): Promise<Refund[]> {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    const ent = payment.entrepreneurId
      ? await this.entrepreneurs.findOne({ where: { id: payment.entrepreneurId } })
      : null;
    const isAdmin = user.role === UserRole.ADMIN;
    const isSeller = !!ent && ent.ownerId === user.userId;
    const isBuyer = payment.payerUserId === user.userId;
    if (!isAdmin && !isSeller && !isBuyer) {
      throw new ForbiddenException('No puedes ver este pago');
    }
    return this.refunds.find({ where: { paymentId } });
  }

  // ---------- Consultas ----------

  async viewAs(paymentId: string, user: AuthUser): Promise<OwnerPayment> {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    const ent = payment.entrepreneurId
      ? await this.entrepreneurs.findOne({ where: { id: payment.entrepreneurId } })
      : null;
    const isAdmin = user.role === UserRole.ADMIN;
    const isSeller = !!ent && ent.ownerId === user.userId;
    const isBuyer = payment.payerUserId === user.userId;
    if (!isAdmin && !isSeller && !isBuyer) {
      throw new ForbiddenException('No puedes ver este pago');
    }
    return this.toOwnerView(payment);
  }

  async listMine(userId: string, q: { page?: number; limit?: number }): Promise<{
    items: OwnerPayment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const [rows, total] = await this.payments
      .createQueryBuilder('p')
      .where('p.payerUserId = :userId', { userId })
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: rows.map((p) => this.toOwnerView(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminList(
    q: { page?: number; limit?: number; status?: PaymentStatus },
    user: AuthUser,
  ): Promise<{
    items: OwnerPayment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede listar pagos');
    }
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.payments
      .createQueryBuilder('p')
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    const rows = await qb.getMany();
    const countQb = this.payments.createQueryBuilder('p');
    if (q.status) countQb.andWhere('p.status = :status', { status: q.status });
    const total = await countQb.getCount();
    return {
      items: rows.map((p) => this.toOwnerView(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
