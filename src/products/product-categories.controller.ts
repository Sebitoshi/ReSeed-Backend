import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { ProductCategoriesService } from './product-categories.service.js';

class CreateCategoryDto {
  @ApiPropertyOptional({ example: 'Miel y Derivados', description: 'Nombre de la categoria' })
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Categoria padre para subcategorias (solo 1 nivel).',
  })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ default: true, description: 'Si la categoria esta activa' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Miel y Derivados' })
  @IsString()
  @Length(2, 100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Activa o desactiva la categoria' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@ApiTags('Categorias de productos')
@ApiBearerAuth('jwt')
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly service: ProductCategoriesService) {}

  @Public()
  @Get('public/tree')
  @ApiOperation({
    summary: 'Arbol de categorias (publico)',
    description: 'Categorias activas organizadas en un arbol de hasta 2 niveles (categoria y subcategoria). No requiere token.',
  })
  tree() {
    return this.service.tree();
  }

  @Public()
  @Get('public/counts')
  @ApiOperation({
    summary: 'Conteo de productos por categoria (publico)',
    description: 'Devuelve, para cada categoria, cuantos productos publicados tiene. Util para filtros del catalogo.',
  })
  counts() {
    return this.service.counts();
  }

  @Post()
  @ApiOperation({
    summary: 'Crear categoria (admin)',
    description: 'Solo administradores. Genera un slug unico automaticamente.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar categoria (admin)',
    description: 'Solo administradores. Permite renombrar o activar/desactivar.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Desactivar categoria (admin)',
    description: 'La marca como inactiva. No borra productos asociados.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  deactivate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(user, id);
  }
}
