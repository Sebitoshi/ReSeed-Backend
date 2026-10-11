// Uso:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm exec tsx scripts/create-admin.ts
// o sin .env, pásalo por CLI: pnpm exec tsx scripts/create-admin.ts admin@x.com pass1234
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { postgresSslOptions } from '../src/database/postgres-ssl.js';

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);
  const email = (emailArg ?? process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();
  const password = passwordArg ?? process.env.ADMIN_PASSWORD ?? '';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: pnpm exec tsx scripts/create-admin.ts <email> <password>');
    console.error('   o define ADMIN_EMAIL / ADMIN_PASSWORD en .env');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('La contrasena debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    username: process.env.POSTGRES_USER ?? 'reseed',
    password: process.env.POSTGRES_PASSWORD ?? 'reseed',
    database: process.env.POSTGRES_DB ?? 'reseed',
    ...postgresSslOptions(),
    entities: [User],
    synchronize: false,
  });
  await ds.initialize();

  const repo = ds.getRepository(User);
  const exists = await repo.findOne({ where: { email } });
  if (exists) {
    console.log(`El usuario ${email} ya existe (rol ${exists.role}). Nada que hacer.`);
    await ds.destroy();
    return;
  }

  await repo.save(
    repo.create({
      email,
      name: 'Administrador',
      passwordHash: await bcrypt.hash(password, 10),
      role: UserRole.ADMIN,
    }),
  );
  console.log(`Administrador creado: ${email}`);
  await ds.destroy();
}

void main().catch((err) => {
  console.error('Error:', err?.message ?? err);
  process.exit(1);
});
