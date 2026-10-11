import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity.js';

// El rol admin no se puede auto-asignar en el registro publico.
export const REGISTRABLE_ROLES = [UserRole.ENTREPRENEUR, UserRole.BUYER, UserRole.VOLUNTEER] as const;

export class RegisterDto {
  @ApiProperty({ example: 'ana@ejemplo.com', description: 'Correo electronico unico del usuario' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Secreto123',
    description: 'Contrasena en texto plano (minimo 8 caracteres). Se guarda hasheada.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Ana Perez', description: 'Nombre visible del usuario' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.ENTREPRENEUR,
    description: 'Rol a asignar. No puede ser "admin" (solo se otorga manualmente).',
  })
  @IsEnum(REGISTRABLE_ROLES, {
    message: 'role debe ser emprendedor, comprador o voluntario',
  })
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Secreto123' })
  @IsString()
  @MinLength(1)
  password!: string;
}
