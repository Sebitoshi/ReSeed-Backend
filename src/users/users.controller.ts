import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthUser } from './decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto.js';
import { UserRole } from './entities/user.entity.js';

@ApiTags('Usuarios')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Listar roles disponibles (autenticado)' })
  getRoles() {
    return { roles: Object.values(UserRole) };
  }

  @Get('me')
  @ApiOperation({
    summary: 'Obtener mi perfil',
    description: 'Devuelve el perfil del usuario autenticado (sin la contrasena).',
  })
  async me(@CurrentUser() user: AuthUser) {
    const found = await this.usersService.findById(user.userId);
    return this.usersService.toPublic(found!);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Actualizar mi perfil',
    description: 'Actualiza nombre, biografia y telefono del usuario autenticado.',
  })
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    const found = await this.usersService.findById(user.userId);
    const updated = await this.usersService.updateProfile(found!, dto);
    return this.usersService.toPublic(updated);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cambiar mi contrasena',
    description: 'Requiere la contrasena actual. Devuelve 204 sin contenido si es exitoso.',
  })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    const found = await this.usersService.findById(user.userId);
    await this.usersService.changePassword(found!, dto.currentPassword, dto.newPassword);
  }
}
