import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../entrepreneurs/dto/list-query.dto.js';
import {
  CollectionUnit,
  MaterialType,
  SignupStatus,
  VolunteerStatus,
} from '../entities/volunteer.entity.js';

export class CreateVolunteerDto {
  @ApiProperty({ example: 'Jornada de limpieza del humedal' })
  @IsString()
  @Length(3, 150)
  title!: string;

  @ApiProperty({ description: 'Que se hace, a quien ayuda y que deben llevar' })
  @IsString()
  @Length(10, 5000)
  description!: string;

  @ApiPropertyOptional({ example: 'Parque La Esperanza, Bogota' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiProperty({ description: 'Fecha y hora de inicio (ISO 8601)' })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ description: 'Fin (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Cupos disponibles; omitir para ilimitado', example: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  slots?: number;

  @ApiPropertyOptional({ description: 'Imagen de portada (URL)' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  @MaxLength(255)
  imageUrl?: string;
}

export class UpdateVolunteerDto {
  @ApiPropertyOptional() @IsString() @Length(3, 150) @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @Length(10, 5000) @IsOptional() description?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(255) location?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startsAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endsAt?: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional() @Type(() => Number) slots?: number;
  @ApiPropertyOptional() @IsUrl({ require_tld: false }) @IsOptional() @MaxLength(255) imageUrl?: string;
}

export class ReviewSignupDto {
  @ApiPropertyOptional({ description: 'Motivo (obligatorio al rechazar)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

export class ListVolunteerDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VolunteerStatus, description: 'Filtra por estado (solo admin)' })
  @IsEnum(VolunteerStatus)
  @IsOptional()
  status?: VolunteerStatus;
}

export class ListSignupsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SignupStatus, description: 'Filtra por estado de inscripcion' })
  @IsEnum(SignupStatus)
  @IsOptional()
  status?: SignupStatus;

  @ApiPropertyOptional({ description: 'Filtra por actividad', format: 'uuid' })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  activityId?: string;
}

// ---------- Materiales recolectados ----------

export class CreateCollectionDto {
  @ApiProperty({ enum: MaterialType, description: 'Tipo de material recolectado' })
  @IsEnum(MaterialType)
  material!: MaterialType;

  @ApiProperty({
    description:
      'Cantidad en la unidad base: gramos si unit=kg, piezas si unit=unidad, bultos si unit=bulto. Ej. 25000 = 25 kg.',
    example: 25000,
  })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ enum: CollectionUnit, description: 'Unidad de medida de la cantidad' })
  @IsEnum(CollectionUnit)
  unit!: CollectionUnit;

  @ApiPropertyOptional({
    description: 'Fecha real de la recoleccion (ISO 8601). Por defecto, ahora.',
  })
  @IsDateString()
  @IsOptional()
  collectedAt?: string;

  @ApiPropertyOptional({
    description:
      'Producto de materia prima en el que se transformo; cierra la traza jornada -> material -> materia prima. Requiere el id de un producto.',
    format: 'uuid',
  })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  rawMaterialProductId?: string;

  @ApiPropertyOptional({ description: 'Observaciones: calidad, humedad, incidencias.' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateCollectionDto {
  @ApiPropertyOptional({ enum: MaterialType })
  @IsEnum(MaterialType)
  @IsOptional()
  material?: MaterialType;

  @ApiPropertyOptional({ description: 'Cantidad en la unidad base (ver CreateCollectionDto)' })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  @IsOptional()
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ enum: CollectionUnit })
  @IsEnum(CollectionUnit)
  @IsOptional()
  unit?: CollectionUnit;

  @ApiPropertyOptional({ description: 'Fecha de la recoleccion (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  collectedAt?: string;

  @ApiPropertyOptional({ description: 'Vincula con un producto de materia prima', format: 'uuid' })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  rawMaterialProductId?: string;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class ListCollectionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MaterialType, description: 'Filtra por tipo de material' })
  @IsEnum(MaterialType)
  @IsOptional()
  material?: MaterialType;

  @ApiPropertyOptional({ description: 'Filtra por actividad (jornada)', format: 'uuid' })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  activityId?: string;

  @ApiPropertyOptional({
    description:
      'Filtra por producto de materia prima al que quedo vinculado. Envia "none" para ver las recolecciones aun sin transformar.',
  })
  @IsString()
  @MaxLength(36)
  @IsOptional()
  rawMaterialProductId?: string;

  @ApiPropertyOptional({ description: 'Inicia el rango de fechas (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Termina el rango de fechas (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  to?: string;
}
