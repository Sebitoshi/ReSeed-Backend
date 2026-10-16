// Promueve a admin una cuenta que YA existe (create-admin.ts solo crea nuevas).
//
// Uso:
//   pnpm exec tsx scripts/make-admin.ts mazoosebas@gmail.com
//
// El rol admin no se puede auto-asignar desde la app; este script lo fija
// directamente en la base de datos.
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/users/entities/user.entity.js';
import { postgresSslOptions } from '../src/database/postgres-ssl.js';

async function main() {
  const [emailArg] = process.argv.slice(2);
  const email = (emailArg ?? process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: pnpm exec tsx scripts/make-admin.ts <email>');
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
  const user = await repo.findOne({ where: { email } });
  if (!user) {
    console.error(
      `No existe una cuenta con el correo ${email}. Regístrala en la app y vuelve a ejecutar.`,
    );
    await ds.destroy();
    process.exit(1);
  }

  if (user.role === UserRole.ADMIN) {
    console.log(`${email} ya es admin (cuenta ${user.isActive ? 'activa' : 'inactiva'}). Nada que hacer.`);
    await ds.destroy();
    return;
  }

  const anterior = user.role;
  user.role = UserRole.ADMIN;
  await repo.save(user);
  console.log(`Listo: ${email} pasó de "${anterior}" a admin.`);
  await ds.destroy();
}

void main().catch((err) => {
  console.error('Error:', err?.message ?? err);
  process.exit(1);
});
