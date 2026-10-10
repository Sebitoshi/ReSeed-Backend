import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1760000000000 implements MigrationInterface {
  name = 'Init1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(`CREATE TYPE "public"."entrepreneurs_status_enum" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'suspendido')`);
    await queryRunner.query(`CREATE TABLE "entrepreneurs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "name" character varying(150) NOT NULL,
      "slug" character varying(160) NOT NULL,
      "description" text NOT NULL,
      "category" character varying(100),
      "logo_url" character varying(255),
      "contact_phone" character varying(100),
      "contact_email" character varying(255),
      "status" "entrepreneurs_status_enum" NOT NULL DEFAULT 'pendiente',
      "review_note" text,
      "owner_id" uuid NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "PK_entrepreneurs" PRIMARY KEY ("id"),
      CONSTRAINT "FK_entrepreneurs_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_entrepreneurs_slug" ON "entrepreneurs" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_entrepreneurs_status" ON "entrepreneurs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_entrepreneurs_owner" ON "entrepreneurs" ("owner_id")`);

    await queryRunner.query(`CREATE TYPE "public"."entrepreneur_status_logs_to_status_enum" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'suspendido')`);
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
    await queryRunner.query(`CREATE INDEX "IDX_logs_entrepreneur_created" ON "entrepreneur_status_logs" ("entrepreneur_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_logs_entrepreneur" ON "entrepreneur_status_logs" ("entrepreneur_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "entrepreneur_status_logs"`);
    await queryRunner.query(`DROP TYPE "public"."entrepreneur_status_logs_to_status_enum"`);
    await queryRunner.query(`DROP TABLE "entrepreneurs"`);
    await queryRunner.query(`DROP TYPE "public"."entrepreneurs_status_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
