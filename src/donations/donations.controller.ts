import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../users/decorators/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { DonationsService } from './donations.service.js';
import { CreateDonationDto, ListDonationsQueryDto } from './dto/donation.dto.js';

@ApiTags('Donaciones')
@ApiBearerAuth('jwt')
@Controller('donations')
export class DonationsController {
  constructor(private readonly service: DonationsService) {}

  @ApiOperation({
    summary: 'Aportar (campana o fondo general)',
    description:
      'Crea la donacion y la intencion de pago que la cobra. Si se omite campaignId, el aporte va al fondo general de la plataforma. La donacion queda pendiente hasta que el checkout se confirme.',
  })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDonationDto) {
    return this.service.create(user, dto);
  }

  @ApiOperation({
    summary: 'Mis donaciones',
    description: 'Historial paginado de aportes del usuario autenticado.',
  })
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: ListDonationsQueryDto) {
    return this.service.listMine(user.userId, query);
  }

  @ApiOperation({
    summary: 'Estado del recaudo',
    description:
      'Totales, fondo general, avance de cada campana activa y los ultimos aportes confirmados.',
  })
  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @ApiOperation({
    summary: 'Listar donaciones (admin)',
    description: 'Bandera global de aportes con filtro por estado, solo para administradores.',
  })
  @Roles(UserRole.ADMIN)
  @Get('admin/list')
  adminList(@Query() query: ListDonationsQueryDto) {
    return this.service.adminList(query);
  }

  @ApiOperation({
    summary: 'Resumen de donaciones (admin)',
    description: 'Cantidades por estado, recaudo total y recaudo por campana.',
  })
  @Roles(UserRole.ADMIN)
  @Get('admin/stats')
  adminStats() {
    return this.service.adminStats();
  }
}
