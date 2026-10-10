import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { ProductCategoriesService } from './product-categories.service.js';

class CreateCategoryDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateCategoryDto {
  @IsString()
  @Length(2, 100)
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly service: ProductCategoriesService) {}

  @Public()
  @Get('public/tree')
  tree() {
    return this.service.tree();
  }

  @Public()
  @Get('public/counts')
  counts() {
    return this.service.counts();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.service.create(user, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  deactivate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(user, id);
  }
}
