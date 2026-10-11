import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cuenta "soft-ban": el admin puede desactivar usuarios sin borrarlos.
 * Una cuenta desactivada no puede iniciar sesion ni validar su JWT.
 */
export class UsersSoftBan1760000004000 implements MigrationInterface {
  name = 'UsersSoftBan1760000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasIsActive = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active'`,
    );
    if (hasIsActive.length === 0) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`);
    }

    const hasDeactivatedAt = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deactivated_at'`,
    );
    if (hasDeactivatedAt.length === 0) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMPTZ`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deactivated_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"`);
  }
}
