import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { RolesGuard, Roles } from '../users/decorators/roles.guard.js';

import { UserRole } from '../users/entities/user.entity.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';

@ApiTags('Autenticacion')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  @ApiOperation({
    summary: 'Registrar un usuario nuevo',
    description:
      'Crea una cuenta con rol emprendedor, comprador o voluntario. El rol admin no se puede auto-asignar. Devuelve accessToken y el perfil.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesion',
    description:
      'Valida credenciales y devuelve un JWT (accessToken) para usar como Bearer token. Sujeto a rate limiting: 5 intentos por minuto.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Get('roles')
  @ApiOperation({
    summary: 'Listar roles disponibles',
    description: 'Devuelve la lista de roles que existen en la plataforma.',
  })
  getRoles() {
    return { roles: Object.values(UserRole) };
  }

  // Endpoint de ejemplo protegido solo para administradores.
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/only')
  @ApiOperation({
    summary: 'Ejemplo de endpoint solo-admin',
    description: 'Requiere rol admin. Sirve como prueba de que el guard de roles funciona.',
  })
  adminOnly(@CurrentUser() user: AuthUser) {
    return { message: `Hola ${user.email}, eres ${user.role}` };
  }
}
