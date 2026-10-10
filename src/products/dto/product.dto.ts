import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @Length(2, 180)
  name!: string;

  @IsString()
  @MinLength(10, { message: 'La descripcion debe tener al menos 10 caracteres' })
  @Length(10, 4000)
  description!: string;

  // Precio en centavos (unidad menor) para evitar errores de redondeo.
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  priceCents!: number;

  // Sin stock finito = servicio. Con stock = inventario ajustable.
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsUUID()
  categoryId!: string;

  // El dueño lo asigna a uno de SUS emprendimientos (o null si solo tiene uno).
  @IsUUID()
  @IsOptional()
  entrepreneurId?: string;

  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @Length(2, 180)
  @IsOptional()
  name?: string;

  @IsString()
  @Length(10, 4000)
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  @IsOptional()
  priceCents?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/** Reemplaza el set completo de imagenes del producto. */
export class ReplaceImagesDto {
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  images!: string[];
}

/** Publica/despublica sin borrado. */
export class PublishingResultDto {
  @IsUUID()
  id!: string;

  @IsString()
  status!: 'publicado' | 'borrador' | 'despublicado';
}

export class ListProductsQueryDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  entrepreneurId?: string;

  @IsString()
  @IsOptional()
  q?: string;
}
