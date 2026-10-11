import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historial de notificaciones: cada correo enviado (o intentado) queda
 * registrado para que el usuario vea su historial y el admin audite el SMTP.
 */
export class Notifications1760000005000 implements MigrationInterface {
  name = 'Notifications1760000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='notifications'`,
    );
    if (hasTable.length > 0) return;

    await queryRunner.query(`
      CREATE TYPE "notifications_type_enum" AS ENUM (
        'registro', 'pago', 'reembolso', 'emprendimiento', 'voluntariado', 'campana', 'sistema'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "notifications_status_enum" AS ENUM ('enviada', 'fallida', 'omitida')
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "to_email" varchar(255) NOT NULL,
        "type" notifications_type_enum NOT NULL DEFAULT 'sistema',
        "status" notifications_status_enum NOT NULL DEFAULT 'omitida',
        "subject" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "reference_type" varchar(60),
        "reference_id" uuid,
        "sent_at" timestamptz,
        "read_at" timestamptz,
        "error" text,
        "attempts" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_created" ON "notifications" ("user_id", "created_at")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_notifications_type" ON "notifications" ("type")`);
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_type_enum"`);
  }
}
