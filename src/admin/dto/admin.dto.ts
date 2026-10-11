import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../entrepreneurs/dto/list-query.dto.js';
import { UserRole } from '../../users/entities/user.entity.js';
import { ProductStatus } from '../../products/entities/product.entity.js';

export class ListUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserRole, description: 'Filtra por rol' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Busqueda por nombre o email (parcial)' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Filtra por cuenta activa (true) o desactivada (false)' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ChangeRoleDto {
  @ApiProperty({
    enum: UserRole,
    description: 'Nuevo rol del usuario',
    example: UserRole.ENTREPRENEUR,
  })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class ChangeUserStatusDto {
  @ApiProperty({
    description: 'false desactiva la cuenta (bloquea login y JWT); true la reactiva',
    example: false,
  })
  @IsBoolean()
  isActive!: boolean;

  @ApiPropertyOptional({ description: 'Motivo registrado en el asunto' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class ListModerationProductsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProductStatus, description: 'Filtra por estado de publicacion' })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Busqueda por nombre o descripcion' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Incluye tambien los archivados (soft-delete)' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeArchived?: boolean;
}

export class ReportRangeDto {
  @ApiPropertyOptional({ description: 'Inicio del rango (ISO 8601). Por defecto: hace 30 dias.' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Fin del rango (ISO 8601). Por defecto: hoy.' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: 'Zona horaria del reporte', example: 'America/Bogota' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  tz?: string;
}

export class BroadcastNotificationDto {
  @ApiProperty({ description: 'Asunto del correo' })
  @IsString()
  @Length(3, 200)
  subject!: string;

  @ApiProperty({
    description: 'Cuerpo en texto plano; se convierte a un correo HTML con el layout de la plataforma',
    example: 'Este domingo hay feria de emprendimientos en el parque central.',
  })
  @IsString()
  @Length(3, 5000)
  message!: string;

  @ApiPropertyOptional({ description: 'Enlace opcional agregado al final del correo' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  link?: string;
}
