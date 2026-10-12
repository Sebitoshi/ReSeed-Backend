// Debe ser el primer import: carga .env antes de que AppModule lea process.env
// (SMTP, JWT, puerto). Sin esto, cualquier valor sin default queda undefined.
import 'dotenv/config';
// Dependencias que TypeORM/Swagger cargan en runtime con require() dinamico:
// el import estatico hace que el tracer de Vercel las incluya en la lambda.
import './serverless-deps.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz del proyecto compilado: dist/ (local) o src/ (en la lambda de Vercel).
// En ambos casos '..' lleva a la raiz, donde build copia swagger-assets/.
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
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
    // Los assets de swagger-ui viajan a la lambda en swagger-assets/ (lo copia
    // scripts/bundle-vercel.mjs): nft no traza los archivos dinamicos del
    // paquete node_modules, y sin esto /docs carga pero sus .js/.css dan 404.
    customSwaggerUiPath: join(projectRoot, 'swagger-assets'),
  });

  await app.listen(process.env.PORT ?? 3000);
}

// En serverless (Vercel) la invocacion no debe morir si el arranque inicial
// (p.ej. la conexion a Postgres) falla o tarda: se registra y se relanza,
// dejando que el request actual reciba un 500 del runtime en vez de un crash.
bootstrap().catch((error) => {
  console.error('[bootstrap] Fallo al iniciar la aplicacion:', error);
  process.exitCode = 1;
});
