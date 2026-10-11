import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VolunteerActivity, VolunteerSignup } from './entities/volunteer.entity.js';
import { VolunteerService } from './volunteer.service.js';
import { VolunteerController } from './volunteer.controller.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([VolunteerActivity, VolunteerSignup]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [VolunteerController],
  providers: [VolunteerService],
  exports: [VolunteerService],
})
export class VolunteerModule {}
