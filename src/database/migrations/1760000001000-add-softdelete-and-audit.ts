import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteAndAudit1760000001000 implements MigrationInterface {
  name = 'AddSoftDeleteAndAudit1760000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasDeletedAt = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='entrepreneurs' AND column_name='deleted_at'`,
    );
    if (hasDeletedAt.length === 0) {
      await queryRunner.query(`ALTER TABLE "entrepreneurs" ADD COLUMN "deleted_at" TIMESTAMPTZ`);
    }

    const hasLogsTable = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='entrepreneur_status_logs'`,
    );
    if (hasLogsTable.length === 0) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "entrepreneur_status_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."entrepreneur_status_logs_to_status_enum"`);
    await queryRunner.query(`ALTER TABLE "entrepreneurs" DROP COLUMN IF EXISTS "deleted_at"`);
  }
}
