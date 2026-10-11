import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Cualquier usuario autenticado puede solicitar la publicacion de su negocio.
export class CreateEntrepreneurDto {
  @ApiProperty({ example: 'Miel Dorada', description: 'Nombre del negocio o marca' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: 'Miel pura de apicultores locales de pequenas granjas de la sierra.',
    description: 'Descripcion del negocio (minimo 20 caracteres)',
    minLength: 20,
  })
  @IsString()
  @MinLength(20, { message: 'La descripcion debe tener al menos 20 caracteres' })
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ example: 'Cosmetica', description: 'Categoria del negocio' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'https://cdn.ejemplo.com/logo.png', description: 'URL del logo' })
  @IsUrl()
  @MaxLength(255)
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '+56912345678', description: 'Telefono de contacto publico' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({
    example: 'contacto@mieldorada.cl',
    description: 'Email de contacto publico',
  })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  contactEmail?: string;
}

// El dueño puede editar el contenido mientras lo revisamos; el admin, todo.
export class UpdateEntrepreneurDto {
  @ApiPropertyOptional({ example: 'Miel Dorada' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Nueva descripcion (minimo 20 caracteres)', minLength: 20 })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Cosmetica' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'https://cdn.ejemplo.com/logo-nuevo.png' })
  @IsUrl()
  @MaxLength(255)
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '+56912345678' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'contacto@mieldorada.cl' })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  contactEmail?: string;
}

// Acciones de revision del admin.
export class ReviewActionDto {
  @ApiPropertyOptional({
    example: 'Bienvenido a la plataforma',
    description: 'Nota de la revision. Obligatoria para rechazar y suspender.',
  })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
