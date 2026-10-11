import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial: usuarios, emprendimientos y su historial de estados.
 *
 * Idempotente: cada objeto se crea solo si no existe. Esto importa porque la
 * base local se genero con synchronize=true y luego "adopto" esta migracion
 * (ver adopt-migrations.ts), de modo que Init nunca habia corrido en una base
 * realmente vacia hasta que se apunto a un servidor en la nube.
 */
export class Init1760000000000 implements MigrationInterface {
  name = 'Init1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // CREATE TYPE no admite IF NOT EXISTS; se protege con un bloque DO.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                       WHERE t.typname = 'users_role_enum' AND n.nspname = 'public') THEN
          CREATE TYPE "public"."users_role_enum" AS ENUM ('admin', 'emprendedor', 'comprador', 'voluntario');
        END IF;
      END $$;
    `);

    const hasUsers = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'`,
    );
    if (hasUsers.length === 0) {
      await queryRunner.query(`CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "name" character varying(120) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'comprador',
        "bio" text,
        "phone" character varying(60),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )`);
      await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`);
    }

    const hasEntrepreneurs = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='entrepreneurs'`,
    );
    if (hasEntrepreneurs.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "public"."entrepreneurs_status_enum" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'suspendido')`,
      );
      await queryRunner.query(`CREATE TABLE "entrepreneurs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "slug" character varying(160) NOT NULL,
        "description" text NOT NULL,
        "category" character varying(100),
        "logoUrl" character varying(255),
        "contactPhone" character varying(100),
        "contactEmail" character varying(255),
        "status" "entrepreneurs_status_enum" NOT NULL DEFAULT 'pendiente',
        "reviewNote" text,
        "owner_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_entrepreneurs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_entrepreneurs_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_entrepreneurs_slug" ON "entrepreneurs" ("slug")`,
      );
      await queryRunner.query(`CREATE INDEX "IDX_entrepreneurs_status" ON "entrepreneurs" ("status")`);
      await queryRunner.query(`CREATE INDEX "IDX_entrepreneurs_owner" ON "entrepreneurs" ("owner_id")`);
    }

    const hasLogs = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='entrepreneur_status_logs'`,
    );
    if (hasLogs.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "public"."entrepreneur_status_logs_to_status_enum" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'suspendido')`,
      );
      await queryRunner.query(`CREATE TABLE "entrepreneur_status_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entrepreneur_id" uuid NOT NULL,
        "to_status" "entrepreneur_status_logs_to_status_enum" NOT NULL,
        "actor_id" uuid NOT NULL,
        "actor_role" character varying(20) NOT NULL,
        "note" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entrepreneur_status_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_logs_entrepreneur" FOREIGN KEY ("entrepreneur_id") REFERENCES "entrepreneurs"("id") ON DELETE CASCADE
      )`);
      await queryRunner.query(
        `CREATE INDEX "IDX_logs_entrepreneur_created" ON "entrepreneur_status_logs" ("entrepreneur_id", "created_at")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_logs_entrepreneur" ON "entrepreneur_status_logs" ("entrepreneur_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "entrepreneur_status_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."entrepreneur_status_logs_to_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "entrepreneurs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."entrepreneurs_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }
}
