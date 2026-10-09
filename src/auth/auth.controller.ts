import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { RolesGuard, Roles } from '../users/decorators/roles.guard.js';

import { UserRole } from '../users/entities/user.entity.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Get('roles')
  getRoles() {
    return { roles: Object.values(UserRole) };
  }

  // Endpoint de ejemplo protegido solo para administradores.
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/only')
  adminOnly(@CurrentUser() user: AuthUser) {
    return { message: `Hola ${user.email}, eres ${user.role}` };
  }
}
