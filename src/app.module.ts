import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
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
      // Para produccion se recomienda migraciones en lugar de synchronize.
      synchronize: process.env.TYPEORM_SYNCHRONIZE !== 'false',
    }),
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Exige JWT en todos los endpoints; @Public() para liberar rutas publicas.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
