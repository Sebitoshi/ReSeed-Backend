/**
 * Bundle serverless para desplegar en Vercel.
 *
 * Uso: node scripts/bundle-vercel.mjs   (lo llama `pnpm build`)
 *
 * Por que existe: el runtime de Vercel (shim Rust de Node) no soporta
 * require() de modulos ESM, y @nestjs/throttler 6.x (CJS) hace require()
 * de @nestjs/common 12 (que ahora es ESM puro). Localmente Node >= 22.12
 * lo tolera, pero en el runtime de Vercel produce ERR_REQUIRE_ESM y
 * FUNCTION_INVOCATION_FAILED en cada request.
 *
 * La solucion es bundlear TODO (@nestjs/common incluido) en un unico
 * archivo ESM, para que el runtime no cargue @nestjs/throttler desde
 * node_modules. Quedan externos los paquetes opcionales de Nest que
 * nunca se usan aqui (microservices/websockets/fastify adapters), y los
 * binarios nativos y archivos estaticos no evaluables por esbuild.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const distRoot = path.resolve(root, 'dist');
const entry = path.join(distRoot, 'main.js');
const outdir = path.join(distRoot, 'bundle');

await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: path.join(outdir, 'main.js'),
  // externos de cargadores binarios/opcionales que esbuild no puede evaluar
  external: [
    '@nestjs/microservices',
    '@nestjs/websockets',
    '@fastify/static',
    '@fastify/passport',
    'pg-native',
  ],
  banner: {
    js: "import { createRequire as __vcr } from 'module'; var require = __vcr(import.meta.url);",
  },
  logLevel: 'warning',
});

// NestJS Swagger sirve los assets estaticos de swagger-ui-dist leyendolos
// de node_modules en runtime; los copiamos junto al bundle.
const pnpmRoot = path.join(root, 'node_modules/.pnpm');
const swaggerCandidates = fs
  .readdirSync(pnpmRoot)
  .filter((d) => d.startsWith('swagger-ui-dist@'));
const assetsDstDir = path.join(outdir, 'node_modules/swagger-ui-dist');
fs.mkdirSync(assetsDstDir, { recursive: true });

for (const candidate of swaggerCandidates) {
  // Cada gestor instala en distinta profundidad; buscamos absolute-path.js
  // como guia, porque siempre existe dentro del paquete.
  const targets = fs
    .readdirSync(pnpmRoot, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name === 'absolute-path.js')
    .map((e) => path.join(e.parentPath, e.name));

  for (const absPathJs of targets) {
    const base = path.dirname(absPathJs);
    // pnpm expone los assets tanto en el paquete raiz como en dist/
    const srcDir = fs.existsSync(path.join(base, 'dist')) ? path.join(base, 'dist') : base;
    for (const f of fs.readdirSync(srcDir)) {
      if (f.endsWith('.css') || f.endsWith('.js.map') || f.endsWith('.js')) {
        fs.copyFileSync(path.join(srcDir, f), path.join(assetsDstDir, f));
      }
    }
    // swagger-ui usa absolute-path.js para resolver su directorio en runtime
    fs.copyFileSync(absPathJs, path.join(outdir, 'absolute-path.js'));
    // y tambien su package.json para que CommonJS pueda resolver 'swagger-ui-dist/absolute-path.js'
    // desde el bundle como un paquete propio.
    fs.writeFileSync(
      path.join(assetsDstDir, 'package.json'),
      JSON.stringify({ name: 'swagger-ui-dist', main: 'absolute-path.js' }, null, 2),
    );
    fs.copyFileSync(absPathJs, path.join(assetsDstDir, 'absolute-path.js'));
  }
}

console.log('[bundle-vercel] Bundle generado en', outdir);

// Externos omitidos del bundle (pg, etc.): los copiamos a node_modules junto
// al bundle para que la resolucion CommonJS del runtime los encuentre. Vercel
// incluye node_modules del build, pero el layout pnpm anidado no siempre es
// alcanzable desde dist/bundle (DriverPackageNotInstalledError en TypeORM).
const runtimeDeps = ['pg', 'pg-connection-string', 'pg-protocol', 'pg-types', 'pg-pool', 'pg-int8', 'pgpass', 'postgres-array', 'postgres-bytea', 'postgres-date', 'postgres-interval', 'split2', 'packet-reader', 'buffer-writer', 'pg-cloudflare', 'ndjson', 'xtend', 'openssl-defaults', 'tar-stream', 'fs-minipass', 'minipass', 'yallist', 'once', 'wrappy', 'magic-bytes.js', 'bcryptjs', 'nodemailer'];
const bundleNodeModules = path.join(outdir, 'node_modules');
fs.mkdirSync(bundleNodeModules, { recursive: true });

function copyPackage(name) {
  let resolved;
  try {
    resolved = require.resolve ? null : null;
  } catch {}
  // buscar en el arbol de pnpm
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === name) { found.push(p); return; }
        walk(p, depth + 1);
      }
    }
  };
  walk(path.join(root, 'node_modules/.pnpm'), 0);
  for (const src of found) {
    const dst = path.join(bundleNodeModules, name);
    if (fs.existsSync(dst)) continue;
    fs.cpSync(src, dst, { recursive: true });
  }
  if (found.length) console.log(`[bundle-vercel] ${name} copiado a node_modules del bundle`);
  else console.warn(`[bundle-vercel] AVISO: no se encontró ${name}`);
}

for (const dep of runtimeDeps) copyPackage(dep);
