import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { EntrepreneursModule } from './entrepreneurs/entrepreneurs.module.js';
import { ProductsModule } from './products/products.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { JwtAuthGuard } from './users/decorators/jwt-auth.guard.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'reseed',
      password: process.env.POSTGRES_PASSWORD ?? 'reseed',
      database: process.env.POSTGRES_DB ?? 'reseed',
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
  ],
  providers: [
    // Exige JWT en todos los endpoints; @Public() para liberar rutas publicas.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
