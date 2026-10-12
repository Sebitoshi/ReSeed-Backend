/**
 * Imports estáticos de dependencias que en runtime se cargan con require()
 * dinámico. Vercel (nft) arma la lambda trazando solo imports estáticos desde
 * src/main.ts: TypeORM llama `PlatformTools.load('pg')` en PostgresDriver, así
 * que sin este módulo el paquete `pg` nunca viaja a la función y se produce
 * DriverPackageNotInstalledError ("Please run npm install pg").
 *
 * Debe importarse desde main.ts (punto de entrada reconocido por Vercel).
 * El side-effect import no ejecuta nada; solo fija la referencia para el tracer.
 */
import 'pg';
// SwaggerModule sirve los assets de /docs con require('swagger-ui-dist/absolute-path.js')
// tambien dinamico; el import estatico garantiza que nft lo incluya en la lambda.
import 'swagger-ui-dist/absolute-path.js';

import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);

// nft (el tracer de Vercel) sigue require.resolve() con literales e incluye
// cada archivo resuelto en la lambda. Sin esto, /docs devuelve 200 pero sus
// assets (bundle.js, css, favicons) responden 404 porque nunca viajaron.
void require_.resolve('swagger-ui-dist/swagger-ui-bundle.js');
void require_.resolve('swagger-ui-dist/swagger-ui-standalone-preset.js');
void require_.resolve('swagger-ui-dist/index.css');
void require_.resolve('swagger-ui-dist/oauth2-redirect.js');
void require_.resolve('swagger-ui-dist/favicon-16x16.png');
void require_.resolve('swagger-ui-dist/favicon-32x32.png');
