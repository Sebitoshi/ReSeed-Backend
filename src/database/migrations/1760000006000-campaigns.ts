import { MigrationInterface, QueryRunner } from 'typeorm';

/** Campanas de la plataforma, gestionadas por el panel admin. */
export class Campaigns1760000006000 implements MigrationInterface {
  name = 'Campaigns1760000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='campaigns'`,
    );
    if (hasTable.length > 0) return;

    await queryRunner.query(`
      CREATE TYPE "campaigns_status_enum" AS ENUM ('borrador', 'activa', 'finalizada')
    `);
    await queryRunner.query(`
      CREATE TABLE "campaigns" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(150) NOT NULL,
        "slug" varchar(160) NOT NULL,
        "summary" varchar(255),
        "description" text NOT NULL,
        "image_url" varchar(255),
        "goal_cents" bigint,
        "donation_url" varchar(255),
        "status" campaigns_status_enum NOT NULL DEFAULT 'borrador',
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_campaigns_slug" ON "campaigns" ("slug")`);
    await queryRunner.query(`CREATE INDEX "idx_campaigns_status" ON "campaigns" ("status")`);
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD CONSTRAINT "fk_campaigns_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "campaigns"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "campaigns_status_enum"`);
  }
}
