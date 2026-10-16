import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Entrepreneur } from '../entrepreneurs/entities/entrepreneur.entity.js';
import { EntrepreneurStatusLog } from '../entrepreneurs/entities/entrepreneur-status-log.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { ProductCategory } from '../products/entities/product-category.entity.js';
import { ProductImage } from '../products/entities/product-image.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Refund } from '../payments/entities/refund.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Campaign } from '../campaigns/entities/campaign.entity.js';
import { Donation } from '../donations/entities/donation.entity.js';
import {
  MaterialCollection,
  VolunteerActivity,
  VolunteerSignup,
} from '../volunteer/entities/volunteer.entity.js';
import { postgresSslOptions } from './postgres-ssl.js';
import { postgresPoolOptions } from './postgres-pool.js';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'reseed',
  password: process.env.POSTGRES_PASSWORD ?? 'reseed',
  database: process.env.POSTGRES_DB ?? 'reseed',
  ...postgresSslOptions(),
  // Pool pequeno tambien para migrations/scripts; ver postgres-pool.ts.
  extra: postgresPoolOptions(),
  entities: [
    User,
    Entrepreneur,
    EntrepreneurStatusLog,
    Product,
    ProductCategory,
    ProductImage,
    Payment,
    Refund,
    Notification,
    Campaign,
    Donation,
    VolunteerActivity,
    VolunteerSignup,
    MaterialCollection,
  ],
  // Las migraciones son la unica fuente de esquema; nunca synchronize.
  synchronize: false,
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
});
