import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Verificacion del correo en el registro.
 *
 * El registro deja de entregar el token de inmediato: guarda un codigo de 6
 * digitos (hasheado) y solo lo revela al confirmar que el correo es real. La
 * tabla users gana las columnas para sostener ese estado.
 *
 * Los usuarios ya existentes se marcan como verificados. No hacerlo los dejaria
 * sin poder iniciar sesion tras el despliegue de este cambio.
 */
export class EmailVerification1760000010000 implements MigrationInterface {
  name = 'EmailVerification1760000010000';

  private async addColumn(
    queryRunner: QueryRunner,
    definition: string,
  ): Promise<void> {
    // definition: '"nombre" tipo'
    const column = definition.split(' ')[0].replace(/"/g, '');
    const has = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='users' AND column_name=$1`,
      [column],
    );
    if (has.length === 0) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN ${definition}`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumn(queryRunner, '"email_verified_at" TIMESTAMPTZ');
    await this.addColumn(queryRunner, '"verification_code_hash" character varying(255)');
    await this.addColumn(queryRunner, '"verification_expires_at" TIMESTAMPTZ');
    await this.addColumn(queryRunner, '"verification_sent_at" TIMESTAMPTZ');
    await this.addColumn(
      queryRunner,
      '"verification_attempts" integer NOT NULL DEFAULT 0',
    );

    // Los registros anteriores a este cambio no pasaron por el codigo, pero su
    // correo ya es valido en la practica: se dan por verificados.
    await queryRunner.query(
      `UPDATE "users" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL`,
    );

    // Nuevo tipo de notificacion; IF NOT EXISTS deja la migracion re-ejecutable.
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'verificacion'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_sent_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_code_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified_at"`,
    );
    // Postgres no permite quitar un valor de un enum ya usado; se deja el tipo
    // 'verificacion' sin efecto.
  }
}
