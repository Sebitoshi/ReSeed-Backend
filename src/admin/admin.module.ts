import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { EntrepreneurStatusLog } from '../entrepreneurs/entities/entrepreneur-status-log.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Refund } from '../payments/entities/refund.entity.js';
import { Campaign } from '../campaigns/entities/campaign.entity.js';
import { Donation } from '../donations/entities/donation.entity.js';
import { VolunteerActivity, VolunteerSignup } from '../volunteer/entities/volunteer.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';

/**
 * Panel administrativo: solo backend. No renderiza vista alguna; expone los
 * endpoints que consume el panel (que vive en otro repo/frontend).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Entrepreneur,
      EntrepreneurStatusLog,
      Product,
      Payment,
      Refund,
      Campaign,
      Donation,
      VolunteerActivity,
      VolunteerSignup,
      Notification,
    ]),
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
