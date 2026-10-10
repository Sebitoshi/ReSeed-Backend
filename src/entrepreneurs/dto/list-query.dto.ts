import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EntrepreneurStatus } from '../entities/entrepreneur.entity.js';

// Limites de paginacion compartidos por listados.
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: 'limit maximo: ' + MAX_PAGE_SIZE })
  @IsOptional()
  limit?: number = DEFAULT_PAGE_SIZE;
}

export class DirectoryQueryDto extends PaginationDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  categoria?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;
}

// Reusa los filtros de revision + paginacion.
export class AdminReviewListQueryDto extends PaginationDto {
  @IsEnum(EntrepreneurStatus, {
    message: 'status debe ser pendiente, aprobado, rechazado o suspendido',
  })
  @IsOptional()
  status?: EntrepreneurStatus;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  ownerId?: string;
}
