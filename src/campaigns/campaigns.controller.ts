import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../users/decorators/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { CampaignsService } from './campaigns.service.js';
import { CreateCampaignDto, ListCampaignsDto, UpdateCampaignDto } from './dto/campaign.dto.js';

@ApiTags('Campanas')
@ApiBearerAuth('jwt')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  // --- Publico (sin token) ---

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'Campanas publicas',
    description: 'Lista las campanas publicadas. Paginado. No requiere token.',
  })
  listPublic(@Query() query: ListCampaignsDto) {
    return this.service.listPublic(query);
  }

  @Public()
  @Get('public/:slug')
  @ApiOperation({ summary: 'Detalle publico de una campana por slug' })
  @ApiParam({ name: 'slug', example: 'semana-de-la-miel-solidaria' })
  bySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  // --- Solo admin ---

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({
    summary: 'Listar campanas (admin)',
    description: 'Todas las campanas con su estado de revision, filtrables por estado.',
  })
  list(@CurrentUser() user: AuthUser, @Query() query: ListCampaignsDto) {
    return this.service.list(user, query);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/archived')
  @ApiOperation({ summary: 'Campanas archivadas (admin)', description: 'Soft-delete, restaurables.' })
  archived(@CurrentUser() user: AuthUser, @Query() query: ListCampaignsDto) {
    return this.service.archived(user, query);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de campana (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  view(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.viewAdmin(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Crear campana (admin)',
    description: 'Nace en estado "borrador"; no se ve en el listado publico hasta publicarla.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.service.create(user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar campana (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.update(id, user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publicar campana (admin)', description: 'Pasa a "activa" y aparece en el listado publico.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.publish(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalizar campana (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/notify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Difundir campana por correo (admin)',
    description:
      'Envia la campana a todos los usuarios activos por SMTP y registra cada envio en el historial de notificaciones.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  notify(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.notifyAll(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archivar campana (admin)', description: 'Soft-delete; se puede restaurar.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar campana archivada (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.restore(id, user);
  }
}
