import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { RolesGuard, Roles } from '../users/decorators/roles.guard.js';

import { UserRole } from '../users/entities/user.entity.js';
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';

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
      'Crea una cuenta con rol emprendedor, comprador o voluntario. El rol admin no se puede auto-asignar. ' +
      'Si la verificacion por correo esta activa, responde con requiresVerification=true y no entrega token ' +
      'hasta confirmar el codigo en /auth/verify-email.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar el correo con el codigo de 6 digitos',
    description:
      'Valida el codigo enviado al registrarse. Al acertar, marca la cuenta como verificada y devuelve ' +
      'accessToken. Permite 5 intentos por codigo; luego hay que pedir uno nuevo.',
  })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenviar el codigo de verificacion',
    description:
      'Genera un codigo nuevo y lo envia por correo. Responde de forma neutra sin revelar si el correo ' +
      'esta registrado o ya verificado. Hay una espera de 60 segundos entre reenvios.',
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pedir un codigo para recuperar la contrasena',
    description:
      'Envia por correo un codigo de 6 digitos. Responde de forma neutra sin revelar si el correo tiene ' +
      'cuenta. Hay una espera de 60 segundos entre solicitudes.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar la contrasena con el codigo recibido',
    description:
      'Valida el codigo y aplica la contrasena nueva. Al hacerlo se cierran las demas sesiones: los tokens ' +
      'emitidos antes dejan de servir. Permite 5 intentos por codigo; luego hay que pedir uno nuevo.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
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
  @ApiBearerAuth('jwt')
  @Get('admin/only')
  @ApiOperation({
    summary: 'Ejemplo de endpoint solo-admin',
    description: 'Requiere rol admin. Sirve como prueba de que el guard de roles funciona.',
  })
  adminOnly(@CurrentUser() user: AuthUser) {
    return { message: `Hola ${user.email}, eres ${user.role}` };
  }
}
