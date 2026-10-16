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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../users/decorators/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { AuthUser } from '../users/decorators/current-user.decorator.js';
import { ProductsService } from './products.service.js';
import {
  CreateProductDto,
  ListRawMaterialsQueryDto,
  UpdateProductDto,
} from './dto/product.dto.js';

/**
 * Materia prima que vende la plataforma.
 *
 * Reutiliza el ciclo de vida de cualquier producto (borrador, publicado,
 * despublicado, archivado) pero los productos cuelgan del vendedor del sistema
 * y siempre son de tipo materia_prima. Solo el admin gestiona esta seccion.
 */
@ApiTags('Materia prima (plataforma)')
@ApiBearerAuth('jwt')
@Roles(UserRole.ADMIN)
@Controller('admin/raw-materials')
export class RawMaterialsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar materia prima (admin)',
    description:
      'Productos de tipo materia_prima en cualquier estado. Permite filtrar por estado, busqueda e incluir archivados.',
  })
  list(@CurrentUser() user: AuthUser, @Query() query: ListRawMaterialsQueryDto) {
    return this.service.listRawMaterials(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear materia prima (borrador)',
    description:
      'Crea un producto de materia_prima a nombre de la plataforma (vendedor del sistema). Nace en borrador; luego se publica.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.service.createRawMaterial(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver materia prima (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  view(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.viewAs(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar materia prima',
    description: 'Editar un producto publicado lo devuelve a borrador (regla editorial).',
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
  @ApiOperation({ summary: 'Publicar materia prima' })
  @ApiParam({ name: 'id', format: 'uuid' })
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.publish(id, user);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Despublicar materia prima' })
  @ApiParam({ name: 'id', format: 'uuid' })
  unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.unpublish(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archivar materia prima (soft-delete)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id, user);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar materia prima archivada' })
  @ApiParam({ name: 'id', format: 'uuid' })
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.restoreRawMaterial(id, user);
  }
}
