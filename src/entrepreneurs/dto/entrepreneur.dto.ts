import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EntrepreneurStatus } from '../entities/entrepreneur.entity.js';

// Cualquier usuario autenticado puede solicitar la publicacion de su negocio.
export class CreateEntrepreneurDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(20, { message: 'La descripcion debe tener al menos 20 caracteres' })
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @IsUrl()
  @MaxLength(255)
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  contactEmail?: string;
}

// El dueño puede editar el contenido mientras lo revisamos; el admin, todo.
export class UpdateEntrepreneurDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @IsUrl()
  @MaxLength(255)
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  contactEmail?: string;
}

// Acciones de revision del admin.
export class ReviewActionDto {
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}

// Listado de solicitudes para el panel admin.
export class AdminReviewListQueryDto {
  @IsEnum(EntrepreneurStatus, {
    message: 'status debe ser pendiente, aprobado, rechazado o suspendido',
  })
  @IsOptional()
  status?: EntrepreneurStatus;

  @IsUUID()
  @IsOptional()
  ownerId?: string;
}

export class EntrepreneurIdParamDto {
  @IsUUID()
  id!: string;
}
