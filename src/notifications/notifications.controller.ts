import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../users/decorators/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { ListAdminNotificationsDto, ListMyNotificationsDto } from './dto/notifications.dto.js';

@ApiTags('Notificaciones')
@ApiBearerAuth('jwt')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // --- Usuario autenticado ---

  @Get('mine')
  @ApiOperation({
    summary: 'Mi historial de notificaciones',
    description: 'Notificaciones que el usuario recibio (email y registro interno), paginadas.',
  })
  mine(@CurrentUser() user: AuthUser, @Query() query: ListMyNotificationsDto) {
    return this.service.listMine(user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Conteo de notificaciones no leidas' })
  unread(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.userId);
  }

  // --- Solo admin (log completo y herramientas de SMTP) ---

  @Roles(UserRole.ADMIN)
  @Get('admin/list')
  @ApiOperation({
    summary: 'Log de notificaciones (admin)',
    description: 'Todas las notificaciones enviadas, fallidas u omitidas, con filtros.',
  })
  adminList(@Query() query: ListAdminNotificationsDto) {
    return this.service.adminList(query);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/stats')
  @ApiOperation({ summary: 'Estadisticas de notificaciones (admin)' })
  stats() {
    return this.service.stats();
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/smtp')
  @ApiOperation({
    summary: 'Estado del SMTP (admin)',
    description: 'Indica si el servidor tiene Gmail SMTP configurado y habilitado.',
  })
  smtpStatus() {
    return {
      configurado: this.service.smtpEnabled,
      mensaje: this.service.smtpEnabled
        ? 'SMTP habilitado: los correos se envian por Gmail.'
        : 'SMTP deshabilitado: las notificaciones se guardan con estado "omitida".',
    };
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar correo de prueba (admin)',
    description: 'Verifica la conexion con Gmail y envia un correo al admin autenticado.',
  })
  test(@CurrentUser() user: AuthUser) {
    return this.service.sendTest(user);
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/:id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar una notificacion (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  resend(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.resend(id, user);
  }

  // --- Usuario: marcar como leida (al final por orden de rutas) ---

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una notificacion como leida' })
  @ApiParam({ name: 'id', format: 'uuid' })
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markAsRead(id, user);
  }
}
