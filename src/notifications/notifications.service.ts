import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity.js';
import { User } from '../users/entities/user.entity.js';
import { MailService } from './mail.service.js';
import { renderEmail, renderPlainText, templates } from './templates.js';
import type { EmailContent } from './templates.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import type {
  ListAdminNotificationsDto,
  ListMyNotificationsDto,
} from './dto/notifications.dto.js';

export interface SendNotificationInput {
  /** Destino directo (por si no hay usuario registrado, p.ej. contacto de ficha). */
  email?: string;
  userId?: string | null;
  content: EmailContent;
  type: NotificationType;
  referenceType?: string;
  referenceId?: string;
}

export interface BroadcastResult {
  total: number;
  enviadas: number;
  fallidas: number;
  omitidas: number;
}

export interface PaginatedNotifications {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Fachada de notificaciones: guarda SIEMPRE el registro en BD y luego intenta
 * enviar el correo. Nunca lanza excepciones hacia el flujo que lo invoca
 * (registro, pago, aprobacion...), para que un SMTP caido no rompa la API.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  /** URL base de la plataforma para los botones de los correos. */
  private appUrl(): string {
    return process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  }

  get smtpEnabled(): boolean {
    return this.mail.isEnabled;
  }

  /** Guarda y envia. Devuelve la notificacion registrada (o null si no hay destino). */
  async send(input: SendNotificationInput): Promise<Notification | null> {
    let email = input.email?.toLowerCase().trim();
    let userId = input.userId ?? null;

    if (!email && userId) {
      const user = await this.users.findOne({ where: { id: userId } });
      if (!user) {
        this.logger.warn(`Notificacion omitida: usuario ${userId} inexistente`);
        return null;
      }
      email = user.email;
    }
    if (!email) {
      this.logger.warn('Notificacion sin destino: falta email y userId');
      return null;
    }

    const record = await this.repo.save(
      this.repo.create({
        userId,
        email,
        type: input.type,
        status: NotificationStatus.OMITIDA,
        subject: input.content.title,
        body: renderEmail(input.content),
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        error: null,
        attempts: 1,
      }),
    );

    if (!this.mail.isEnabled) {
      this.logger.warn(
        `SMTP deshabilitado; notificacion ${record.id} registrada como omitida (${email})`,
      );
      return record;
    }

    try {
      await this.mail.send(
        email,
        input.content.title,
        record.body,
        renderPlainText(input.content),
      );
      record.status = NotificationStatus.ENVIADA;
      record.sentAt = new Date();
    } catch (err) {
      record.status = NotificationStatus.FALLIDA;
      record.error = (err as Error).message;
    }
    return this.repo.save(record);
  }

  /** Envia a un usuario registrado por su id. */
  async notifyUser(
    userId: string,
    type: NotificationType,
    content: EmailContent,
    ref?: { referenceType?: string; referenceId?: string },
  ): Promise<Notification | null> {
    return this.send({ userId, type, content, ...ref });
  }

  /**
   * Difusion a todos los usuarios activos. Cada destinatario recibe su propia
   * copia (saludo personalizado) y su propio registro; un fallo individual no
   * detiene el resto del envio.
   */
  async broadcastToAllUsers(
    build: (user: { id: string; name: string; email: string }) => EmailContent,
    type: NotificationType,
    ref: { referenceType?: string; referenceId?: string },
  ): Promise<BroadcastResult> {
    const users = await this.users.find({
      select: { id: true, name: true, email: true },
      where: { isActive: true },
    });
    const result: BroadcastResult = {
      total: users.length,
      enviadas: 0,
      fallidas: 0,
      omitidas: 0,
    };
    for (const user of users) {
      const record = await this.send({
        userId: user.id,
        type,
        content: build(user),
        ...ref,
      });
      if (!record) continue;
      if (record.status === NotificationStatus.ENVIADA) result.enviadas += 1;
      else if (record.status === NotificationStatus.FALLIDA) result.fallidas += 1;
      else result.omitidas += 1;
    }
    return result;
  }

  // ---------- Historial del usuario ----------

  async listMine(userId: string, q: ListMyNotificationsDto): Promise<PaginatedNotifications> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.repo.createQueryBuilder('n').where('n.userId = :userId', { userId });
    if (q.type) qb.andWhere('n.type = :type', { type: q.type });
    if (q.unread) qb.andWhere('n.readAt IS NULL');
    const [items, total] = await qb
      .orderBy('n.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.repo.count({ where: { userId, readAt: IsNull() } });
    return { unread };
  }

  async markAsRead(id: string, user: AuthUser): Promise<Notification> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record || record.userId !== user.userId) {
      throw new NotFoundException('Notificacion no encontrada');
    }
    if (!record.readAt) {
      record.readAt = new Date();
      return this.repo.save(record);
    }
    return record;
  }

  // ---------- Panel admin ----------

  async adminList(q: ListAdminNotificationsDto): Promise<PaginatedNotifications> {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const qb = this.repo.createQueryBuilder('n');
    if (q.type) qb.andWhere('n.type = :type', { type: q.type });
    if (q.email) qb.andWhere('n.email ILIKE :email', { email: `%${q.email}%` });
    const [items, total] = await qb
      .orderBy('n.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async stats(): Promise<{
    total: number;
    enviadas: number;
    fallidas: number;
    omitidas: number;
    ultimas24h: number;
    noLeidas: number;
    porTipo: Array<{ type: NotificationType; total: number }>;
  }> {
    const [total, enviadas, fallidas, omitidas, ultimas24h, noLeidas] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { status: NotificationStatus.ENVIADA } }),
      this.repo.count({ where: { status: NotificationStatus.FALLIDA } }),
      this.repo.count({ where: { status: NotificationStatus.OMITIDA } }),
      this.repo
        .createQueryBuilder('n')
        .where('n.createdAt >= :since', { since: new Date(Date.now() - 24 * 3600 * 1000) })
        .getCount(),
      this.repo.count({ where: { readAt: IsNull() } }),
    ]);

    const porTipo = await this.repo
      .createQueryBuilder('n')
      .select('n.type', 'type')
      .addSelect('COUNT(*)', 'total')
      .groupBy('n.type')
      .getRawMany<{ type: NotificationType; total: string }>();

    return {
      total,
      enviadas,
      fallidas,
      omitidas,
      ultimas24h,
      noLeidas,
      porTipo: porTipo.map((r) => ({ type: r.type, total: Number(r.total) })),
    };
  }

  /** Reenvia una notificacion guardada al mismo destino (admin). */
  async resend(id: string, admin: AuthUser): Promise<Notification | null> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Notificacion no encontrada');
    record.attempts += 1;
    if (!this.mail.isEnabled) {
      record.status = NotificationStatus.OMITIDA;
      record.error = 'SMTP deshabilitado en el servidor';
      return this.repo.save(record);
    }
    try {
      await this.mail.send(record.email, record.subject, record.body);
      record.status = NotificationStatus.ENVIADA;
      record.sentAt = new Date();
      record.error = null;
      this.logger.log(`Notificacion ${id} reenviada por ${admin.email}`);
    } catch (err) {
      record.status = NotificationStatus.FALLIDA;
      record.error = (err as Error).message;
    }
    return this.repo.save(record);
  }

  /** Correo de prueba al admin para validar el SMTP de Gmail. */
  async sendTest(admin: AuthUser): Promise<{ enviado: boolean; motivo?: string }> {
    if (!this.mail.isEnabled) {
      return {
        enviado: false,
        motivo: 'SMTP no habilitado: completa SMTP_USER y SMTP_PASS en el .env',
      };
    }
    try {
      await this.mail.verify();
    } catch (err) {
      return { enviado: false, motivo: `Fallo la conexion SMTP: ${(err as Error).message}` };
    }
    const record = await this.send({
      email: admin.email,
      userId: admin.userId,
      type: NotificationType.SISTEMA,
      content: templates.prueba(admin.email, new Date().toLocaleString('es-CO')),
    });
    return { enviado: record?.status === NotificationStatus.ENVIADA };
  }
}
