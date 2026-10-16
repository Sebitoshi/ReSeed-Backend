import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { DonationStatus } from '../entities/donation.entity.js';

/** Aporte minimo: 1.000 centavos de COP (10 pesos). */
export const MIN_DONATION_CENTS = 1000;

export class CreateDonationDto {
  @ApiProperty({
    description: 'Monto del aporte en centavos (entero >= 1000)',
    example: 5000000,
  })
  @IsInt()
  @Min(MIN_DONATION_CENTS)
  @Type(() => Number)
  amountCents!: number;

  @ApiPropertyOptional({
    description: 'Campana destino. Si se omite, el aporte va al fondo general.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @ApiPropertyOptional({
    description: 'Dedicatoria que acompanara al aporte',
    example: 'En memoria de mi abuela',
  })
  @IsString()
  @IsOptional()
  @MaxLength(280)
  message?: string;

  @ApiPropertyOptional({
    description: 'Si es true, el nombre del donante no se muestra en el listado publico',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  anonymous?: boolean;
}

export class ListDonationsQueryDto {
  @ApiPropertyOptional({ description: 'Numero de pagina (empieza en 1)', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Elementos por pagina (maximo 50)', example: 12 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filtra por estado de la donacion',
    enum: DonationStatus,
  })
  @IsEnum(DonationStatus)
  @IsOptional()
  status?: DonationStatus;
}
