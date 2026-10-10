// Para bases de datos creadas con synchronize=true: registra la migracion
// inicial como ya aplicada, sin ejecutarla. Uso:
//   pnpm exec tsx src/database/adopt-migrations.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER ?? 'reseed',
    password: process.env.POSTGRES_PASSWORD ?? 'reseed',
    database: process.env.POSTGRES_DB ?? 'reseed',
    synchronize: false,
  });
  await ds.initialize();

  const logVersion = '1760000000000';
  await ds.query(`CREATE TABLE IF NOT EXISTS "migrations" (
    "id" SERIAL PRIMARY KEY,
    "timestamp" BIGINT NOT NULL,
    "name" character varying NOT NULL
  )`);
  const exists = await ds.query(
    `SELECT 1 FROM "migrations" WHERE "timestamp" = $1`,
    [logVersion],
  );
  if (exists.length === 0) {
    await ds.query(`INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`, [
      logVersion,
      'Init1760000000000',
    ]);
    console.log('Migracion inicial registrada como aplicada.');
  } else {
    console.log('Migracion inicial ya estaba registrada.');
  }
  await ds.destroy();
}

void main().catch((err) => {
  console.error('Error:', err?.message ?? err);
  process.exit(1);
});
