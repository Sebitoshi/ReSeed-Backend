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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../users/decorators/public.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { ProductsService } from './products.service.js';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto.js';

@ApiTags('Productos')
@ApiBearerAuth('jwt')
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // --- Publico (sin token) ---

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'Catalogo publico de productos',
    description:
      'Lista solo los productos PUBLICADOS y activos cuyo emprendimiento esta aprobado. Paginado, con filtros por categoria, emprendimiento y busqueda de texto. No requiere token.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Pagina (empieza en 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Resultados por pagina (max 50)' })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid', description: 'Filtro por categoria' })
  @ApiQuery({ name: 'entrepreneurId', required: false, format: 'uuid', description: 'Filtro por emprendimiento' })
  @ApiQuery({ name: 'q', required: false, description: 'Busqueda en nombre o descripcion' })
  list(@Query() query: ListProductsQueryDto) {
    return this.service.listApproved(query);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({
    summary: 'Detalle publico de un producto',
    description: 'Devuelve un producto publicado y activo. 404 si no existe, no esta publicado o su emprendimiento no esta aprobado.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getApprovedById(id);
  }

  // --- Dueño/admin ---

  @Post()
  @ApiOperation({
    summary: 'Crear un producto (borrador)',
    description:
      'El producto nace en estado "borrador" y solo es visible para su dueño hasta que se publique. Requiere un emprendimiento propio (o indicar entrepreneurId si hay varios).',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.service.create(user, dto);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'Mis productos',
    description: 'Lista paginada de los productos de los emprendimientos del usuario, en cualquier estado.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'q', required: false, description: 'Busqueda en nombre o descripcion' })
  mine(@CurrentUser() user: AuthUser, @Query() query: ListProductsQueryDto) {
    return this.service.listMine(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver un producto (dueño o admin)',
    description: 'Devuelve el producto con su estado de publicacion.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  view(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.viewAs(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar un producto',
    description:
      'Edita nombre, descripcion, precio, stock, categoria o imagenes. Si el producto estaba publicado, vuelve a borrador (requiere republicar).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(id, user, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publicar un producto',
    description:
      'El producto pasa a "publicado" y aparece en el catalogo. Su emprendimiento debe estar aprobado.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.publish(id, user);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Despublicar un producto',
    description: 'Sale del catalogo publico sin borrarse. Puede publicarse de nuevo.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.unpublish(id, user);
  }

  // Borrado logico. Restaurable desde la bandeja admin.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar un producto (borrado logico)',
    description: 'Soft-delete: el producto deja de verse pero el registro se conserva.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id, user);
  }
}
