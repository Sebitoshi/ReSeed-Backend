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
// Los assets estaticos de la UI (bundle.js, css, favicons) se fuerzan con
// includeFiles en vercel.json; no con require.resolve() aqui, porque eso
// truena en runtime si el archivo no viajo a la lambda.
