import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
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

export class VerifyEmailDto {
  @ApiProperty({ example: 'ana@ejemplo.com', description: 'Correo usado en el registro' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '482913',
    description: 'Codigo de 6 digitos recibido por correo',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El codigo debe tener exactamente 6 digitos' })
  code!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'ana@ejemplo.com' })
  @IsEmail()
  email!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ana@ejemplo.com', description: 'Correo de la cuenta a recuperar' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'ana@ejemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482913', minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El codigo debe tener exactamente 6 digitos' })
  code!: string;

  @ApiProperty({ example: 'NuevaClave123', description: 'Nueva contrasena (minimo 8 caracteres)', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password!: string;
}
