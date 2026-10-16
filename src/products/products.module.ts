import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity.js';
import { ProductCategory } from './entities/product-category.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { RawMaterialsController } from './raw-materials.controller.js';
import { ProductCategoriesController } from './product-categories.controller.js';
import { ProductCategoriesService } from './product-categories.service.js';
import { PlatformModule } from '../platform/platform.module.js';

@Module({
  imports: [
    // El repositorio de Entrepreneur se usa para validar pertenencia y estado.
    TypeOrmModule.forFeature([Product, ProductCategory, ProductImage, Entrepreneur]),
    PlatformModule,
  ],
  controllers: [ProductsController, RawMaterialsController, ProductCategoriesController],
  providers: [ProductsService, ProductCategoriesService],
  exports: [ProductsService, ProductCategoriesService],
})
export class ProductsModule {}
