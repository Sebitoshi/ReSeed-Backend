import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PlatformSellerService } from './platform-seller.service.js';

/**
 * Piezas transversales de la plataforma como actor del negocio (hoy: el
 * vendedor de materia prima). Se exporta para que los modulos que lo necesiten
 * lo inyecten sin volver a registrar repositorios.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Entrepreneur, User])],
  providers: [PlatformSellerService],
  exports: [PlatformSellerService],
})
export class PlatformModule {}
