import { MigrationInterface, QueryRunner } from 'typeorm';

export class Payments1760000003000 implements MigrationInterface {
  name = 'Payments1760000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // enum de estados de pago
    await queryRunner.query(`
      CREATE TYPE "payments_status_enum" AS ENUM (
        'pendiente', 'aprobado', 'rechazado', 'reembolsado', 'cancelado'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "refunds_status_enum" AS ENUM ('pendiente', 'aprobado', 'rechazado')
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_ref" varchar(255) NOT NULL,
        "amount_cents" bigint NOT NULL,
        "net_amount_cents" bigint NOT NULL,
        "currency_code" varchar(5) NOT NULL DEFAULT 'COP',
        "status" payments_status_enum NOT NULL,
        "payer_user_id" uuid,
        "entrepreneur_id" uuid,
        "refunded_amount_cents" bigint NOT NULL DEFAULT 0,
        "description" text,
        "confirmed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_payments_external_ref" ON "payments" ("external_ref")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_payer" ON "payments" ("payer_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_status" ON "payments" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_entrepreneur" ON "payments" ("entrepreneur_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_payer" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_entrepreneur" FOREIGN KEY ("entrepreneur_id") REFERENCES "entrepreneurs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "payment_refunds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL,
        "amount_cents" bigint NOT NULL,
        "status" refunds_status_enum NOT NULL,
        "external_ref" varchar(255) NOT NULL,
        "actor_user_id" varchar(255) NOT NULL,
        "reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_refunds_external_ref" ON "payment_refunds" ("external_ref")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refunds_payment" ON "payment_refunds" ("payment_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_refunds" ADD CONSTRAINT "fk_refunds_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_refunds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "refunds_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum"`);
  }
}
