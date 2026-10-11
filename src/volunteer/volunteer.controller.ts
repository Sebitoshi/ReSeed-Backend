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
import { VolunteerService } from './volunteer.service.js';
import {
  CreateVolunteerDto,
  ListSignupsDto,
  ListVolunteerDto,
  ReviewSignupDto,
  UpdateVolunteerDto,
} from './dto/volunteer.dto.js';

@ApiTags('Voluntariados')
@ApiBearerAuth('jwt')
@Controller('volunteer')
export class VolunteerController {
  constructor(private readonly service: VolunteerService) {}

  // --- Publico (sin token) ---

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'Voluntariados abiertos (publico)',
    description: 'Actividades de voluntariado abiertas, con cupos restantes. No requiere token.',
  })
  listPublic(@Query() query: ListVolunteerDto) {
    return this.service.listPublic(query);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Detalle publico de un voluntariado' })
  @ApiParam({ name: 'id', format: 'uuid' })
  viewPublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.viewPublic(id);
  }

  // --- Usuario autenticado ---

  @Get('mine')
  @ApiOperation({ summary: 'Mis inscripciones a voluntariados' })
  mine(@CurrentUser() user: AuthUser, @Query() query: ListVolunteerDto) {
    return this.service.listMine(user.userId, query);
  }

  // --- Solo admin: bandeja de inscripciones ---

  @Roles(UserRole.ADMIN)
  @Get('admin/signups')
  @ApiOperation({
    summary: 'Inscripciones (admin)',
    description: 'Bandeja de inscripciones con el estado y los datos del voluntario.',
  })
  signups(@CurrentUser() user: AuthUser, @Query() query: ListSignupsDto) {
    return this.service.signupsList(user, query);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/archived')
  @ApiOperation({ summary: 'Voluntariados archivados (admin)', description: 'Soft-delete, restaurables.' })
  archived(@CurrentUser() user: AuthUser, @Query() query: ListVolunteerDto) {
    return this.service.adminArchived(user, query);
  }

  @Roles(UserRole.ADMIN)
  @Post('signups/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar inscripcion (admin)',
    description: 'La inscripcion pasa a "confirmado" y el voluntario recibe el correo de confirmacion.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewSignupDto,
  ) {
    return this.service.confirmSignup(id, user, dto.note);
  }

  @Roles(UserRole.ADMIN)
  @Post('signups/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar inscripcion (admin)', description: 'Requiere motivo (note).' })
  @ApiParam({ name: 'id', format: 'uuid' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewSignupDto,
  ) {
    return this.service.rejectSignup(id, user, dto.note);
  }

  // --- Admin: gestion de actividades ---

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Listar voluntariados (admin)', description: 'Todos los estados, con cupos tomados.' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListVolunteerDto) {
    return this.service.adminList(user, query);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Crear voluntariado (admin)',
    description: 'Nace en estado "borrador"; se abre al publico con POST /:id/open.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVolunteerDto) {
    return this.service.adminCreate(user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar voluntariado (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVolunteerDto,
  ) {
    return this.service.adminUpdate(id, user, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abrir inscripciones (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  open(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.open(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar inscripciones (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar como finalizada (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  finish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.finish(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archivar voluntariado (admin)', description: 'Soft-delete; se puede restaurar.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar voluntariado archivado (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.restore(id, user);
  }

  // --- Usuario: inscribirse (al final por orden de rutas) ---

  @Post(':id/signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Inscribirme a un voluntariado',
    description: 'La inscripcion queda "pendiente" hasta que el organizador la confirme.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  signup(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.signup(user.userId, id);
  }

  @Delete(':id/signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar mi inscripcion', description: 'Libera el cupo. No aplica si ya estas confirmado.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(user.userId, id);
  }
}
