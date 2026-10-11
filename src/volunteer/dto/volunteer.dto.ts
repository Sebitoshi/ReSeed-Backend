import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../entrepreneurs/dto/list-query.dto.js';
import { SignupStatus, VolunteerStatus } from '../entities/volunteer.entity.js';

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
