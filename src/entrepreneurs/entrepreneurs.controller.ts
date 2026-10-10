import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { Roles } from '../users/decorators/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { EntrepreneursService } from './entrepreneurs.service.js';
import {
  DirectoryQueryDto,
  AdminReviewListQueryDto,
  PaginationDto,
} from './dto/list-query.dto.js';
import {
  CreateEntrepreneurDto,
  ReviewActionDto,
  UpdateEntrepreneurDto,
} from './dto/entrepreneur.dto.js';

@Controller('entrepreneurs')
export class EntrepreneursController {
  constructor(private readonly service: EntrepreneursService) {}

  // --- Publico (sin token) ---

  @Public()
  @Get('public')
  directory(@Query() query: DirectoryQueryDto) {
    return this.service.findApproved(query);
  }

  @Public()
  @Get('public/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.service.findApprovedBySlug(slug);
  }

  // --- Autenticado ---

  @UseGuards(AuthGuard('jwt'))
  @Post()
  submit(@CurrentUser() user: AuthUser, @Body() dto: CreateEntrepreneurDto) {
    return this.service.submit(user, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.service.listMine(user.userId, query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/history')
  history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.history(id, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  view(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.viewAs(id, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEntrepreneurDto,
  ) {
    return this.service.update(id, user, dto);
  }

  // Reenviar tras rechazo/suspension: vuelve a pendiente.
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/resubmit')
  resubmit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resubmit(id, user);
  }

  // --- Solo admin ---

  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN)
  @Get('admin/review')
  adminList(@CurrentUser() user: AuthUser, @Query() query: AdminReviewListQueryDto) {
    return this.service.adminList(query, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN)
  @Get('admin/archived')
  archived(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.service.listArchived(user, query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
  ) {
    return this.service.approve(id, user, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN)
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
  ) {
    return this.service.reject(id, user, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN)
  @Post(':id/suspend')
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewActionDto,
  ) {
    return this.service.suspend(id, user, dto);
  }

  // Archivado (soft-delete). Restaurable con POST /:id/restore.
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(id, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN)
  @Post(':id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.restore(id, user);
  }
}
