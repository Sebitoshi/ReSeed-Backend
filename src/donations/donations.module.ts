import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation } from './entities/donation.entity.js';
import { Campaign } from '../campaigns/entities/campaign.entity.js';
import { DonationsService } from './donations.service.js';
import { DonationsController } from './donations.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';

/**
 * Donaciones: aportes a una campana o al fondo general. El cobro se delega en
 * PaymentsModule (pasarela sandbox o real) y el estado de la donacion sigue al
 * del pago.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Donation, Campaign]), PaymentsModule],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
