import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../entrepreneurs/dto/list-query.dto.js';
import { NotificationType } from '../entities/notification.entity.js';

export class ListMyNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NotificationType, description: 'Filtra por tipo de notificacion' })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Solo las que aun no ha leido el usuario' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  unread?: boolean;
}

export class ListAdminNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NotificationType, description: 'Filtra por tipo de notificacion' })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filtra por email destino (parcial)' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  email?: string;
}
