import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ana Perez', description: 'Nombre visible del usuario' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Productora de miel organica en la sierra.',
    description: 'Biografia o descripcion corta del usuario',
  })
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: '+56912345678', description: 'Telefono de contacto' })
  @IsString()
  @MaxLength(60)
  phone?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Contrasena actual del usuario' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiPropertyOptional({
    description: 'Nueva contrasena (minimo 8 caracteres)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  newPassword!: string;
}
