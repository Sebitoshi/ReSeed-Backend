import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cada socio puede tener un solo emprendimiento activo.
 *
 * La interfaz ya lo valida, pero la API debe imponerlo tambien para que no se
 * puedan crear fichas duplicadas saltandose el formulario. El indice es parcial
 * (WHERE deleted_at IS NULL) para que una ficha archivada por el admin no
 * bloquee al socio si mas adelante necesita volver a registrarse.
 */
export class EntrepreneurOnePerOwner1760000013000 implements MigrationInterface {
  name = 'EntrepreneurOnePerOwner1760000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_entrepreneurs_owner_active"
       ON "entrepreneurs" ("owner_id") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_entrepreneurs_owner_active"`);
  }
}
