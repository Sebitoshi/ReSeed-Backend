import {
  Body,
  Controller,
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
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { AdminService } from './admin.service.js';
import {
  BroadcastNotificationDto,
  ChangeRoleDto,
  ChangeUserStatusDto,
  ListModerationProductsDto,
  ListUsersDto,
  ReportRangeDto,
} from './dto/admin.dto.js';

@ApiTags('Administracion')
@ApiBearerAuth('jwt')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // ---------- Panel ----------

  @Get('overview')
  @ApiOperation({
    summary: 'Resumen del panel (admin)',
    description: 'Contadores globales: usuarios, emprendimientos, productos, campanas, voluntariados y dinero.',
  })
  overview() {
    return this.service.overview();
  }

  // ---------- Usuarios y roles ----------

  @Get('users')
  @ApiOperation({ summary: 'Listar usuarios (admin)', description: 'Paginado, con filtro por rol, estado y busqueda.' })
  users(@Query() query: ListUsersDto) {
    return this.service.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Detalle de usuario (admin)', description: 'Perfil mas un resumen de su actividad.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUser(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({
    summary: 'Cambiar rol (admin)',
    description: 'Aplica de inmediato: el JWT se valida contra la base en cada request.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.service.changeRole(id, dto, user);
  }

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activar o desactivar cuenta (admin)',
    description: 'Una cuenta desactivada no puede iniciar sesion ni usar su token.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserStatusDto,
  ) {
    return this.service.changeUserStatus(id, dto, user);
  }

  // ---------- Moderacion de productos ----------

  @Get('moderation/products')
  @ApiOperation({
    summary: 'Moderar productos (admin)',
    description: 'Todos los productos (cualquier estado, incluidos borradores) con su emprendimiento.',
  })
  moderationProducts(@Query() query: ListModerationProductsDto) {
    return this.service.moderationProducts(query);
  }

  @Post('moderation/products/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Despublicar producto (admin)', description: 'Lo saca del catalogo publico.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.unpublishProduct(id);
  }

  @Post('moderation/products/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar producto archivado (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  restoreProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.restoreProduct(id);
  }

  // ---------- Difusion ----------

  @Post('notifications/broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar correo a todos los usuarios (admin)',
    description: 'Difusion general por SMTP; cada envio queda registrado en el historial.',
  })
  broadcast(@CurrentUser() user: AuthUser, @Body() dto: BroadcastNotificationDto) {
    return this.service.broadcast(dto, user);
  }

  // ---------- Reportes de actividad ----------

  @Get('reports/activity')
  @ApiOperation({
    summary: 'Reporte de actividad (admin)',
    description: 'Series diarias de altas: usuarios, emprendimientos, productos, pagos, inscripciones y notificaciones.',
  })
  activity(@Query() query: ReportRangeDto) {
    return this.service.reportActivity(query);
  }

  @Get('reports/users')
  @ApiOperation({ summary: 'Reporte de usuarios (admin)', description: 'Altas por dia y distribucion por rol.' })
  reportUsers(@Query() query: ReportRangeDto) {
    return this.service.reportUsers(query);
  }

  @Get('reports/entrepreneurs')
  @ApiOperation({ summary: 'Reporte de emprendimientos (admin)', description: 'Altas por dia, estados y revisiones.' })
  reportEntrepreneurs(@Query() query: ReportRangeDto) {
    return this.service.reportEntrepreneurs(query);
  }

  @Get('reports/payments')
  @ApiOperation({ summary: 'Reporte de pagos (admin)', description: 'Montos por estado, serie diaria y top emprendimientos.' })
  reportPayments(@Query() query: ReportRangeDto) {
    return this.service.reportPayments(query);
  }

  @Get('reports/volunteer')
  @ApiOperation({ summary: 'Reporte de voluntariados (admin)', description: 'Inscripciones por dia, estado y actividades mas pedidas.' })
  reportVolunteer(@Query() query: ReportRangeDto) {
    return this.service.reportVolunteer(query);
  }
}
