import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { EntrepreneurStatusLog } from '../entrepreneurs/entities/entrepreneur-status-log.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { ProductCategory } from '../products/entities/product-category.entity.js';
import { ProductImage } from '../products/entities/product-image.entity.js';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'reseed',
  password: process.env.POSTGRES_PASSWORD ?? 'reseed',
  database: process.env.POSTGRES_DB ?? 'reseed',
  entities: [
    User,
    Entrepreneur,
    EntrepreneurStatusLog,
    Product,
    ProductCategory,
    ProductImage,
  ],
  // Las migraciones son la unica fuente de esquema; nunca synchronize.
  synchronize: false,
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});
