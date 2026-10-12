import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recuperacion de contrasena por codigo enviado al correo.
 *
 * Repite el patron de la verificacion de correo pero con estado propio: si no,
 * quien esta esperando un codigo de verificacion veria invalidado el suyo al
 * pedir un restablecimiento, y viceversa.
 *
 * Agrega ademas password_changed_at, que JwtStrategy usa para descartar tokens
 * emitidos antes del ultimo cambio de clave. Sin eso, restablecer la contrasena
 * no desalojaria a quien este usando un token robado o perdido.
 */
export class PasswordReset1760000011000 implements MigrationInterface {
  name = 'PasswordReset1760000011000';

  private async addColumn(queryRunner: QueryRunner, definition: string): Promise<void> {
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
    await this.addColumn(queryRunner, '"password_reset_code_hash" character varying(255)');
    await this.addColumn(queryRunner, '"password_reset_expires_at" TIMESTAMPTZ');
    await this.addColumn(queryRunner, '"password_reset_sent_at" TIMESTAMPTZ');
    await this.addColumn(
      queryRunner,
      '"password_reset_attempts" integer NOT NULL DEFAULT 0',
    );
    await this.addColumn(queryRunner, '"password_changed_at" TIMESTAMPTZ');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "password_changed_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_sent_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_code_hash"`,
    );
  }
}
