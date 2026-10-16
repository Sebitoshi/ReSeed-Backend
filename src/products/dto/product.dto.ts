import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus, ProductType } from '../entities/product.entity.js';

export class CreateProductDto {
  @ApiProperty({ example: 'Miel de Ulmo', description: 'Nombre del producto' })
  @IsString()
  @Length(2, 180)
  name!: string;

  @ApiProperty({
    example: 'Miel monofloral de ulmo cosechada en bosques nativos del sur.',
    description: 'Descripcion del producto (minimo 10 caracteres)',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'La descripcion debe tener al menos 10 caracteres' })
  @Length(10, 4000)
  description!: string;

  @ApiProperty({
    example: 8900,
    description:
      'Precio en centavos de la moneda local (unidad menor). Ej: 8900 = $89,00. Evita errores de redondeo con flotantes.',
  })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  priceCents!: number;

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    description:
      'Unidades disponibles. Si se omite, el producto se considera un servicio con stock ilimitado.',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiProperty({ format: 'uuid', description: 'Categoria del producto' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Emprendimiento al que pertenece el producto. Obligatorio si el usuario tiene mas de uno.',
  })
  @IsUUID()
  @IsOptional()
  entrepreneurId?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 8,
    example: ['https://cdn.ejemplo.com/ulmo-1.jpg'],
    description: 'Hasta 8 URLs de imagenes, en orden (la primera es la principal)',
  })
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ default: true, description: 'Si esta activo en el catalogo' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Miel de Ulmo' })
  @IsString()
  @Length(2, 180)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Nueva descripcion (minimo 10 caracteres)', minLength: 10 })
  @IsString()
  @Length(10, 4000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 9500, description: 'Nuevo precio en centavos' })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  @IsOptional()
  priceCents?: number;

  @ApiPropertyOptional({ example: 5, description: 'Unidades disponibles' })
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Nueva categoria' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 8,
    description: 'Reemplaza el set completo de imagenes (hasta 8)',
  })
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: 'Activa o desactiva el producto del catalogo' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/** Reemplaza el set completo de imagenes del producto. */
export class ReplaceImagesDto {
  @ApiProperty({
    type: [String],
    maxItems: 8,
    example: ['https://cdn.ejemplo.com/1.jpg'],
    description: 'Hasta 8 URLs de imagenes, en orden',
  })
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  images!: string[];
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ description: 'Numero de pagina (empieza en 1)', default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Resultados por pagina (maximo 50)', default: 12 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtra por categoria' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtra por emprendimiento' })
  @IsUUID()
  @IsOptional()
  entrepreneurId?: string;

  @ApiPropertyOptional({
    example: 'miel',
    description: 'Busqueda por nombre o descripcion (no distingue mayusculas)',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    enum: ProductType,
    description:
      'Filtra por tipo de venta. El catalogo de socios usa "artesania" y la seccion de la plataforma "materia_prima".',
  })
  @IsEnum(ProductType)
  @IsOptional()
  type?: ProductType;
}

/** Listado de materia prima para el panel admin (incluye estados y archivados). */
export class ListRawMaterialsQueryDto {
  @ApiPropertyOptional({ description: 'Numero de pagina (empieza en 1)', default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Resultados por pagina (maximo 50)', default: 12 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: ProductStatus, description: 'Filtra por estado de publicacion' })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Busqueda por nombre o descripcion' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Incluye tambien los archivados (soft-delete)' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeArchived?: boolean;
}
