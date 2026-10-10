import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity.js';

// El rol admin no se puede auto-asignar en el registro publico.
export const REGISTRABLE_ROLES = [UserRole.ENTREPRENEUR, UserRole.BUYER, UserRole.VOLUNTEER] as const;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(REGISTRABLE_ROLES, {
    message: 'role debe ser emprendedor, comprador o voluntario',
  })
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
