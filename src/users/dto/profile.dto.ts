import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity.js';

/**
 * Roles que el propio usuario puede elegir desde su perfil. El rol admin queda
 * fuera a proposito: solo se otorga desde el panel de administracion.
 */
export const SELF_ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.BUYER,
  UserRole.ENTREPRENEUR,
  UserRole.VOLUNTEER,
];

// Todas las propiedades son opcionales: PATCH /users/me acepta actualizar solo
// una, por ejemplo el rol elegido despues del registro.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ana Perez', description: 'Nombre visible del usuario' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Productora de miel organica en la sierra.',
    description: 'Biografia o descripcion corta del usuario',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: '+56912345678', description: 'Telefono de contacto' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @ApiPropertyOptional({
    enum: SELF_ASSIGNABLE_ROLES,
    example: UserRole.BUYER,
    description:
      'Rol con el que quiero usar la plataforma (comprador, emprendedor o voluntario). Se elige tras el registro.',
  })
  @IsOptional()
  @IsIn(SELF_ASSIGNABLE_ROLES, { message: 'role debe ser comprador, emprendedor o voluntario' })
  role?: UserRole;
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
