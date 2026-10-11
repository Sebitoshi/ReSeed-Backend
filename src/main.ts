// Debe ser el primer import: carga .env antes de que AppModule lea process.env
// (SMTP, JWT, puerto). Sin esto, cualquier valor sin default queda undefined.
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // rawBody es requerido para validar la firma HMAC de los webhooks de pagos.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Documentacion interactiva en /docs (en espanol).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Reseed API')
    .setDescription(
      'API de la plataforma Reseed: autenticacion, emprendimientos y catalogo de productos.',
    )
    .setVersion('1.0.0')
    .addTag('Autenticacion', 'Registro, inicio de sesion y roles')
    .addTag('Usuarios', 'Perfil y password del usuario autenticado')
    .addTag('Emprendimientos', 'Fichas de emprendimientos: directorio publico, dueno y revision admin')
    .addTag('Productos', 'Catalogo de productos: publico, dueno y publicacion')
    .addTag('Categorias de productos', 'Arbol y conteos de categorias')
    .addTag('Pagos', 'Intenciones de pago, webhooks y reembolsos')
    .addTag('Notificaciones', 'Historial de notificaciones y envios por correo (SMTP Gmail)')
    .addTag('Campanas', 'Campanas de la plataforma: listado publico y gestion admin')
    .addTag('Voluntariados', 'Actividades de voluntariado, inscripciones y su revision')
    .addTag('Administracion', 'Panel admin: usuarios, roles, moderacion, difusion y reportes')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Pega aqui el accessToken devuelto por /auth/login',
      },
      'jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Documentacion de la API',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
