import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Materia prima vendida directamente por la plataforma.
 *
 * Hasta ahora todos los productos los vendia un socio (emprendimiento). La
 * plataforma tambien vende, pero solo materia prima (el material recuperado en
 * las jornadas de limpieza), asi que se necesita:
 *
 *  - products.type: distinguir artesania de materia prima sin duplicar la
 *    tabla, porque comparten todo el ciclo de venta.
 *  - entrepreneurs.is_system: la ficha vendedora de la plataforma no es un
 *    socio real; se marca para excluirla del directorio y de la revision.
 *  - users.is_system: la cuenta duena de esa ficha es tecnica (no puede
 *    iniciar sesion) y no debe aparecer en los listados del panel.
 *
 * Los productos existentes quedan como 'artesania' (los socios), que es el
 * comportamiento previo.
 */
export class PlatformRawMaterials1760000012000 implements MigrationInterface {
  name = 'PlatformRawMaterials1760000012000';

  private async hasColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [table, column],
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.hasColumn(queryRunner, 'products', 'type'))) {
      await queryRunner.query(
        `ALTER TABLE "products" ADD COLUMN "type" character varying(20) NOT NULL DEFAULT 'artesania'`,
      );
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_type" ON "products" ("type")`,
    );

    if (!(await this.hasColumn(queryRunner, 'entrepreneurs', 'is_system'))) {
      await queryRunner.query(
        `ALTER TABLE "entrepreneurs" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false`,
      );
    }

    if (!(await this.hasColumn(queryRunner, 'users', 'is_system'))) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_type"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "type"`);
    await queryRunner.query(`ALTER TABLE "entrepreneurs" DROP COLUMN IF EXISTS "is_system"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_system"`);
  }
}
