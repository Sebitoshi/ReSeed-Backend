import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { Roles } from '../users/decorators/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { EntrepreneursService } from './entrepreneurs.service.js';
import {
  DirectoryQueryDto,
  AdminReviewListQueryDto,
  PaginationDto,
} from './dto/list-query.dto.js';
import {
  CreateEntrepreneurDto,
  ReviewActionDto,
  UpdateEntrepreneurDto,
} from './dto/entrepreneur.dto.js';

@ApiTags('Emprendimientos')
@ApiBearerAuth('jwt')
@ApiSecurity('admin', ['admin'])
@Controller('entrepreneurs')
export class EntrepreneursController {
  constructor(private readonly service: EntrepreneursService) {}

  // --- Publico (sin token) ---

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'Directorio publico de emprendimientos',
    description:
      'Lista solo los emprendimientos APROBADOS y no archivados. Paginado, con filtro por categoria y busqueda de texto. No requiere token.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Pagina (empieza en 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Resultados por pagina (max 50)' })
  @ApiQuery({ name: 'categoria', required: false, description: 'Filtro por categoria exacta' })
  @ApiQuery({ name: 'q', required: false, description: 'Busqueda en nombre o descripcion' })
  directory(@Query() query: DirectoryQueryDto) {
    return this.service.findApproved(query);
  }

  @Public()
  @Get('public/:slug')
  @ApiOperation({
    summary: 'Perfil publico por slug',
    description: 'Devuelve un emprendimiento aprobado por su slug amigable. 404 si no existe o no esta aprobado.',
  })
  @ApiParam({ name: 'slug', example: 'miel-dorada' })
  bySlug(@Param('slug') slug: string) {
    return this.service.findApprovedBySlug(slug);
  }

  // --- Autenticado ---

  @Post()
  @ApiOperation({
    summary: 'Solicitar publicacion de un emprendimiento',
    description:
      'Cualquier usuario autenticado puede crear su ficha (solo una por socio). Entra en estado "pendiente" hasta que un admin la revise.',
  })
  submit(@CurrentUser() user: AuthUser, @Body() dto: CreateEntrepreneurDto) {
    return this.service.submit(user, dto);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'Mis emprendimientos',
    description: 'Lista paginada de las fichas del usuario autenticado, con estado de revision.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  mine(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.service.listMine(user.userId, query);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Historial de auditoria',
    description:
      'Linea de tiempo de cambios de estado (quien, cuando y nota). Visible solo para el dueño o un admin.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.history(id, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver una ficha (dueño o admin)',
    description: 'Devuelve la vista del dueño, incluyendo estado de revision y motivo.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  view(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.viewAs(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar la ficha',
    description: 'El dueño edita el contenido; el admin puede todo.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEntrepreneurDto,
  ) {
    return this.service.update(id, user, dto);
  }

  // Reenviar tras rechazo/suspension: vuelve a pendiente.
  @Post(':id/resubmit')
  @ApiOperation({
    summary: 'Reenviar a revision',
    description: 'Solo funciona si la ficha esta rechazada o suspendida. Vuelve a "pendiente".',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  resubmit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resubmit(id, user);
  }

  // --- Solo admin ---

  @Roles(UserRole.ADMIN)
  @Get('admin/review')
  @ApiOperation({
    summary: 'Cola de revision (admin)',
    description: 'Lista paginada de solicitudes, con filtros por estado y propietario.',
  })
  @ApiQuery({ name: 'status', required: false, enum: 'EntrepreneurStatus' })
  @ApiQuery({ name: 'ownerId', required: false, format: 'uuid' })
  adminList(@CurrentUser() user: AuthUser, @Query() query: AdminReviewListQueryDto) {
    return this.service.adminList(query, user);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/archived')
  @ApiOperation({
    summary: 'Bandeja de archivados (admin)',
    description: 'Fichas con soft-delete, restaurables.',
  })
  archived(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.service.listArchived(user, query);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar ficha (admin)', description: 'La ficha pasa a "aprobado" y aparece en el directorio.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
  ) {
    return this.service.approve(id, user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  @ApiOperation({
    summary: 'Rechazar ficha (admin)',
    description: 'Requiere motivo (note). No se puede rechazar una ya aprobada.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
  ) {
    return this.service.reject(id, user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/suspend')
  @ApiOperation({
    summary: 'Suspender ficha (admin)',
    description: 'Requiere motivo. La ficha deja de verse en el directorio.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
  ) {
    return this.service.suspend(id, user, dto);
  }

  // Archivado (soft-delete). Restaurable con POST /:id/restore.
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archivar ficha (admin)',
    description: 'Soft-delete: no borra el registro, lo archiva para poder restaurarlo luego.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/restore')
  @ApiOperation({ summary: 'Restaurar ficha archivada (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.restore(id, user);
  }
}
