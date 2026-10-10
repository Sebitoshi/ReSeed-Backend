import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { ProductsService } from './products.service.js';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // --- Publico (sin token) ---

  @Public()
  @Get('public')
  list(@Query() query: ListProductsQueryDto) {
    return this.service.listApproved(query);
  }

  @Public()
  @Get('public/:id')
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getApprovedById(id);
  }

  // --- Dueño/admin ---

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.service.create(user, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: ListProductsQueryDto) {
    return this.service.listMine(user, query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  view(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.viewAs(id, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(id, user, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.publish(id, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.unpublish(id, user);
  }

  // Borrado logico. Restaurable desde la bandeja admin.
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id, user);
  }
}
