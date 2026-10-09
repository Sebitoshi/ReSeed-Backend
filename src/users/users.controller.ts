import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthUser } from './decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto.js';
import { UserRole } from './entities/user.entity.js';

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('roles')
  getRoles() {
    return { roles: Object.values(UserRole) };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const found = await this.usersService.findById(user.userId);
    return this.usersService.toPublic(found!);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    const found = await this.usersService.findById(user.userId);
    const updated = await this.usersService.updateProfile(found!, dto);
    return this.usersService.toPublic(updated);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    const found = await this.usersService.findById(user.userId);
    await this.usersService.changePassword(found!, dto.currentPassword, dto.newPassword);
  }
}
