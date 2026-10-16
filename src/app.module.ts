import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { EntrepreneursModule } from './entrepreneurs/entrepreneurs.module.js';
import { ProductsModule } from './products/products.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { DonationsModule } from './donations/donations.module.js';
import { VolunteerModule } from './volunteer/volunteer.module.js';
import { AdminModule } from './admin/admin.module.js';
import { JwtAuthGuard } from './users/decorators/jwt-auth.guard.js';
import { RolesGuard } from './users/decorators/roles.guard.js';
import { postgresSslOptions } from './database/postgres-ssl.js';
import { postgresPoolOptions } from './database/postgres-pool.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'reseed',
      password: process.env.POSTGRES_PASSWORD ?? 'reseed',
      database: process.env.POSTGRES_DB ?? 'reseed',
      // TLS opcional (p.ej. Aiven); ver POSTGRES_SSL en .env.
      ...postgresSslOptions(),
      // Pool pequeno por instancia; ver postgres-pool.ts.
      extra: postgresPoolOptions(),
      autoLoadEntities: true,
      // Esquema gestionado EXCLUSIVAMENTE por migraciones. Solo para scaffolding
      // en desarrollo local fresco: TYPEORM_SYNCHRONIZE=true.
      synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
    }),
    UsersModule,
    AuthModule,
    EntrepreneursModule,
    ProductsModule,
    PaymentsModule,
    NotificationsModule,
    CampaignsModule,
    DonationsModule,
    VolunteerModule,
    AdminModule,
  ],
  providers: [
    // Exige JWT en todos los endpoints; @Public() para liberar rutas publicas.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Aplica @Roles(...) en cualquier controller. Sin metadata permite el paso,
    // asi que no afecta a las rutas que no usan roles.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
