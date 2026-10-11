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
import { CampaignStatus } from '../entities/campaign.entity.js';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Semana de la Miel Solidaria' })
  @IsString()
  @Length(3, 150)
  title!: string;

  @ApiPropertyOptional({ description: 'Frase corta que aparece en el listado publico' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  summary?: string;

  @ApiProperty({ description: 'Descripcion completa de la campana' })
  @IsString()
  @Length(10, 5000)
  description!: string;

  @ApiPropertyOptional({ description: 'Imagen de portada (URL)' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  @MaxLength(255)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Meta de recaudo en centavos', example: 5000000 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  goalCents?: number;

  @ApiPropertyOptional({ description: 'Link externo para donar' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  @MaxLength(255)
  donationUrl?: string;

  @ApiPropertyOptional({ description: 'Inicio de vigencia (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Fin de vigencia (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endsAt?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional() @IsString() @Length(3, 150) @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(255) @IsOptional() summary?: string;
  @ApiPropertyOptional() @IsString() @Length(10, 5000) @IsOptional() description?: string;
  @ApiPropertyOptional() @IsUrl({ require_tld: false }) @IsOptional() @MaxLength(255) imageUrl?: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional() @Type(() => Number) goalCents?: number;
  @ApiPropertyOptional() @IsUrl({ require_tld: false }) @IsOptional() @MaxLength(255) donationUrl?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startsAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endsAt?: string;
}

export class ListCampaignsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CampaignStatus, description: 'Filtra por estado (solo admin)' })
  @IsEnum(CampaignStatus)
  @IsOptional()
  status?: CampaignStatus;
}
