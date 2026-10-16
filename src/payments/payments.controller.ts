import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { Roles } from '../users/decorators/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import {
  PaymentsService,
} from './payments.service.js';
import {
  PAYMENTS_GATEWAY,
} from './payments.constants.js';
import type {
  GatewayProvider,
} from './gateway/payment-gateway.interface.js';
import { PaymentStatus } from './entities/payment.entity.js';

export class CreatePaymentHttpDto {
  /** Monto a cobrar en centavos (entero >= 1). */
  @ApiProperty({
    description: 'Monto a cobrar en centavos (entero >= 1)',
    example: 2590000,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  amountCents!: number;

  /** Codigo ISO de la moneda. Por defecto COP (pesos colombianos). */
  @ApiProperty({
    description: 'Codigo ISO de la moneda. Por defecto COP (pesos colombianos)',
    example: 'COP',
    required: false,
  })
  @IsString()
  @IsOptional()
  currencyCode?: string;

  /** Descripcion del cobro que se muestra en el checkout. */
  @ApiProperty({
    description: 'Descripcion del cobro que se muestra en el checkout',
    example: 'Jabon artesanal x3',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  /** UUID del emprendimiento que cobra (para reportes por vendedor). */
  @ApiProperty({
    description: 'UUID del emprendimiento que cobra (para reportes por vendedor)',
    format: 'uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  entrepreneurId?: string;

  /** Metadatos libres que la pasarela devuelve en el webhook. */
  @ApiProperty({
    description: 'Metadatos libres que la pasarela devuelve en el webhook',
    required: false,
    example: { orderId: 'ord-123' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}

export class RefundHttpDto {
  /** Monto a reembolsar en centavos. Si se omite, se reembolsa todo lo pendiente. */
  @ApiProperty({
    description:
      'Monto a reembolsar en centavos. Si se omite, se reembolsa todo lo pendiente',
    example: 1000000,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  amountCents?: number;

  /** Motivo del reembolso, registrado en la auditoria. */
  @ApiProperty({
    description: 'Motivo del reembolso, registrado en la auditoria',
    example: 'Producto danado en envio',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class SandboxOutcomeDto {
  /** Resultado simulado que devolveria la pasarela sandbox. */
  @ApiProperty({
    description: 'Resultado simulado que devolveria la pasarela sandbox',
    enum: ['approved', 'rejected', 'cancelled'],
    example: 'approved',
  })
  @IsIn(['approved', 'rejected', 'cancelled'])
  outcome!: 'approved' | 'rejected' | 'cancelled';
}

export class ListPaymentsQueryDto {
  /** Numero de pagina (empieza en 1). */
  @ApiProperty({
    description: 'Numero de pagina (empieza en 1)',
    example: 1,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  /** Elementos por pagina (maximo 50). */
  @ApiProperty({
    description: 'Elementos por pagina (maximo 50)',
    example: 20,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  /** Filtra por estado del pago. */
  @ApiProperty({
    description: 'Filtra por estado del pago',
    enum: PaymentStatus,
    required: false,
  })
  @IsOptional()
  status?: PaymentStatus;
}

@ApiTags('Pagos')
@ApiBearerAuth('jwt')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    @Inject(PAYMENTS_GATEWAY) private readonly gateway: GatewayProvider,
  ) {}

  @ApiOperation({
    summary: 'Crear intencion de pago (checkout hosted)',
    description:
      'Crea la intencion de pago en la pasarela y devuelve la URL del checkout hosted. Requiere acceso como comprador.',
  })
  @Post('checkout')
  createCheckout(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentHttpDto) {
    return this.service.createCheckout(user, dto);
  }

  @ApiOperation({
    summary: 'Resolver un pago en la pasarela sandbox',
    description:
      'Simula el resultado del checkout cuando la pasarela activa es la "dummy" (sandbox): aprueba, rechaza o cancela un pago pendiente. Solo el comprador del pago (o un admin) puede resolverlo. Con una pasarela real este endpoint queda deshabilitado.',
  })
  @ApiParam({ name: 'id', description: 'UUID del pago', format: 'uuid' })
  @Post(':id/sandbox')
  sandbox(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SandboxOutcomeDto,
  ) {
    if (this.gateway.name !== 'dummy') {
      throw new ForbiddenException('La pasarela sandbox no esta activa');
    }
    return this.service.resolveSandbox(id, user, dto.outcome);
  }

  @ApiOperation({
    summary: 'Webhook de la pasarela (publico)',
    description:
      'Recibe los eventos de la pasarela. Valida la firma criptografica antes de tocar el sistema y devuelve 2xx para que el PSP no reintente innecesariamente.',
  })
  @ApiParam({
    name: 'gateway',
    description: 'Nombre de la pasarela activa (debe coincidir con la configurada)',
    example: 'dummy',
  })
  @Public()
  @Post('webhook/:gateway')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Param('gateway') gatewayName: string,
    @Req() req: Request & { rawBody?: Buffer | string },
  ) {
    if (gatewayName !== this.gateway.name) {
      throw new ForbiddenException('Pasarela no activa');
    }
    const raw = typeof req.rawBody === 'string'
      ? req.rawBody
      : req.rawBody
        ? (req.rawBody as Buffer).toString('utf8')
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const ev = this.gateway.parseAndVerifyWebhook(req.headers as Record<string, string | string[] | undefined>, raw);
    return this.service.processWebhookEvent(ev);
  }

  @ApiOperation({
    summary: 'Solicitar reembolso (total o parcial)',
    description: 'El dueño del pago pide un refund total o parcial. Requiere autenticacion.',
  })
  @ApiParam({ name: 'id', description: 'UUID del pago', format: 'uuid' })
  @Post(':id/refund')
  refund(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundHttpDto,
  ) {
    return this.service.createRefund(id, user, dto);
  }

  @ApiOperation({
    summary: 'Listar reembolsos de un pago',
    description: 'Los refunds registrados del pago: comprador, vendedor o admin.',
  })
  @ApiParam({ name: 'id', description: 'UUID del pago', format: 'uuid' })
  @Get(':id/refunds')
  refunds(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.listRefundsOf(id, user);
  }

  @ApiOperation({
    summary: 'Mis pagos',
    description: 'Historial paginado de pagos del usuario autenticado.',
  })
  @ApiQuery({ name: 'page', description: 'Numero de pagina (empieza en 1)', required: false })
  @ApiQuery({ name: 'limit', description: 'Elementos por pagina (maximo 50)', required: false })
  @ApiQuery({
    name: 'status',
    description: 'Filtra por estado del pago',
    required: false,
    enum: PaymentStatus,
  })
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: ListPaymentsQueryDto) {
    return this.service.listMine(user.userId, query);
  }

  @ApiOperation({
    summary: 'Ver un pago',
    description: 'Detalle del pago visible para el comprador, el vendedor o un admin.',
  })
  @ApiParam({ name: 'id', description: 'UUID del pago', format: 'uuid' })
  @Get(':id')
  view(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.viewAs(id, user);
  }

  @ApiOperation({
    summary: 'Listar todos los pagos (admin)',
    description: 'Bandera global de pagos con filtros, solo para administradores.',
  })
  @ApiQuery({ name: 'page', description: 'Numero de pagina (empieza en 1)', required: false })
  @ApiQuery({ name: 'limit', description: 'Elementos por pagina (maximo 50)', required: false })
  @ApiQuery({
    name: 'status',
    description: 'Filtra por estado del pago',
    required: false,
    enum: PaymentStatus,
  })
  @Roles(UserRole.ADMIN)
  @Get('admin/list')
  adminList(@CurrentUser() user: AuthUser, @Query() query: ListPaymentsQueryDto) {
    return this.service.adminList(query, user);
  }
}
