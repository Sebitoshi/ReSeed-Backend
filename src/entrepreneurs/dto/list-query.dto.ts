import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EntrepreneurStatus } from '../entities/entrepreneur.entity.js';

// Limites de paginacion compartidos por listados.
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

export class PaginationDto {
  @ApiPropertyOptional({ description: 'Numero de pagina (empieza en 1)', default: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: `Cantidad de resultados por pagina (maximo ${MAX_PAGE_SIZE})`,
    default: DEFAULT_PAGE_SIZE,
    example: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: 'limit maximo: ' + MAX_PAGE_SIZE })
  @IsOptional()
  limit?: number = DEFAULT_PAGE_SIZE;
}

export class DirectoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtra por categoria exacta (sin distinguir mayusculas)',
    example: 'Cosmetica',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  categoria?: string;

  @ApiPropertyOptional({
    description: 'Busqueda por nombre o descripcion (no distingue mayusculas)',
    example: 'miel',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;
}

// Reusa los filtros de revision + paginacion.
export class AdminReviewListQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: EntrepreneurStatus,
    description: 'Filtra solicitudes por estado de revision',
  })
  @IsEnum(EntrepreneurStatus, {
    message: 'status debe ser pendiente, aprobado, rechazado o suspendido',
  })
  @IsOptional()
  status?: EntrepreneurStatus;

  @ApiPropertyOptional({ description: 'Filtra por el propietario de la ficha', format: 'uuid' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  ownerId?: string;
}
