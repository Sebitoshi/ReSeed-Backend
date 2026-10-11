import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity.js';
import { User } from '../users/entities/user.entity.js';
import { MailService } from './mail.service.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';

/**
 * Notificaciones de la plataforma: historial persistido + envio por SMTP (Gmail).
 * No importa otros modulos, asi que puede ser importado por auth, payments,
 * entrepreneurs, campaigns y volunteer sin ciclos.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  controllers: [NotificationsController],
  providers: [MailService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
