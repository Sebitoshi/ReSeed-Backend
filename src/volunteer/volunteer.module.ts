import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MaterialCollection,
  VolunteerActivity,
  VolunteerSignup,
} from './entities/volunteer.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { VolunteerService } from './volunteer.service.js';
import { VolunteerController } from './volunteer.controller.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    // Product se inyecta para validar a que materia prima se vincula cada
    // recoleccion; no se importa ProductsModule entero (evita dependencia ciclica).
    TypeOrmModule.forFeature([VolunteerActivity, VolunteerSignup, MaterialCollection, Product]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [VolunteerController],
  providers: [VolunteerService],
  exports: [VolunteerService],
})
export class VolunteerModule {}
