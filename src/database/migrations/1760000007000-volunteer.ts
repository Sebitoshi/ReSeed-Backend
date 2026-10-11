import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Voluntariados: actividades abiertas al publico e inscripciones que pasan
 * por revision del organizador (pendiente -> confirmado / rechazado).
 */
export class Volunteer1760000007000 implements MigrationInterface {
  name = 'Volunteer1760000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasActivities = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='volunteer_activities'`,
    );
    if (hasActivities.length === 0) {
      await queryRunner.query(`
        CREATE TYPE "volunteer_activities_status_enum" AS ENUM ('borrador', 'abierta', 'cerrada', 'finalizada')
      `);
      await queryRunner.query(`
        CREATE TABLE "volunteer_activities" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "title" varchar(150) NOT NULL,
          "description" text NOT NULL,
          "location" varchar(255),
          "starts_at" timestamptz NOT NULL,
          "ends_at" timestamptz,
          "slots" integer,
          "image_url" varchar(255),
          "status" volunteer_activities_status_enum NOT NULL DEFAULT 'borrador',
          "created_by" uuid,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          "deleted_at" timestamptz
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_volunteer_status" ON "volunteer_activities" ("status")`,
      );
      await queryRunner.query(
        `ALTER TABLE "volunteer_activities" ADD CONSTRAINT "fk_volunteer_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
    }

    const hasSignups = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='volunteer_signups'`,
    );
    if (hasSignups.length === 0) {
      await queryRunner.query(`
        CREATE TYPE "volunteer_signups_status_enum" AS ENUM ('pendiente', 'confirmado', 'rechazado', 'cancelado')
      `);
      await queryRunner.query(`
        CREATE TABLE "volunteer_signups" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "activity_id" uuid NOT NULL,
          "user_id" uuid NOT NULL,
          "status" volunteer_signups_status_enum NOT NULL DEFAULT 'pendiente',
          "note" text,
          "confirmed_at" timestamptz,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_signups_activity" ON "volunteer_signups" ("activity_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_signups_user" ON "volunteer_signups" ("user_id")`,
      );
      await queryRunner.query(
        `ALTER TABLE "volunteer_signups" ADD CONSTRAINT "fk_signups_activity" FOREIGN KEY ("activity_id") REFERENCES "volunteer_activities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `ALTER TABLE "volunteer_signups" ADD CONSTRAINT "fk_signups_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "volunteer_signups"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "volunteer_signups_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "volunteer_activities"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "volunteer_activities_status_enum"`);
  }
}
