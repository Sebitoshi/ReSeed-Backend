import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity.js';
import { Refund } from './entities/refund.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { DummyGateway } from './gateway/dummy-gateway.js';
import { PAYMENTS_GATEWAY } from './payments.constants.js';
import type { GatewayProvider } from './gateway/payment-gateway.interface.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

// Eleccion de pasarela por env; hoy solo existe el adapter dummy (sandbox).
function pickGateway(): GatewayProvider {
  const name = process.env.PAYMENTS_GATEWAY ?? 'dummy';
  if (name !== 'dummy') {
    throw new Error(
      `Pasarela "${name}" no implementada aun: el modulo solo tiene el adapter dummy`,
    );
  }
  return new DummyGateway();
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Refund, Entrepreneur]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENTS_GATEWAY, useFactory: pickGateway },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
