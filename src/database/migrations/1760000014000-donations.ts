import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Donaciones: aportes economicos a una campana o al fondo general.
 *
 * Cada donacion se apoya en un pago (payments) para el cobro: por eso
 * `payment_id` es unica y se copia el estado del pago.
 */
export class Donations1760000014000 implements MigrationInterface {
  name = 'Donations1760000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='donations'`,
    );
    if (hasTable.length > 0) return;

    await queryRunner.query(`
      CREATE TYPE "donations_status_enum" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'cancelado', 'reembolsado')
    `);
    await queryRunner.query(`
      CREATE TABLE "donations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "donor_user_id" uuid,
        "campaign_id" uuid,
        "payment_id" uuid,
        "amount_cents" bigint NOT NULL,
        "currency_code" varchar(5) NOT NULL DEFAULT 'COP',
        "status" donations_status_enum NOT NULL DEFAULT 'pendiente',
        "message" text,
        "anonymous" boolean NOT NULL DEFAULT false,
        "confirmed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_donations_donor" ON "donations" ("donor_user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_donations_campaign" ON "donations" ("campaign_id")`);
    await queryRunner.query(`CREATE INDEX "idx_donations_status" ON "donations" ("status")`);
    // Un pago financia a lo sumo una donacion (varios NULL si que se permiten).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_donations_payment" ON "donations" ("payment_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "fk_donations_donor" FOREIGN KEY ("donor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "fk_donations_campaign" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD CONSTRAINT "fk_donations_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "donations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "donations_status_enum"`);
  }
}
