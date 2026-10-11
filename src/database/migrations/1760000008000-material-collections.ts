import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Materiales recolectados en las jornadas de limpieza.
 *
 * Cierra la traza de la plataforma: jornada de voluntariado -> material
 * recolectado -> producto de materia prima -> socio que lo transforma.
 *
 * La cantidad se guarda como entero en la unidad base (gramos si unit='kg',
 * piezas si unit='unidad'/'bulto'), igual que los precios en centavos, para
 * no arrastrar errores de punto flotante en las sumas de inventario.
 */
export class MaterialCollections1760000008000 implements MigrationInterface {
  name = 'MaterialCollections1760000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='material_collections'`,
    );
    if (hasTable.length === 0) {
      await queryRunner.query(`
        CREATE TYPE "material_collections_material_enum" AS ENUM (
          'pet', 'plastico_filme', 'plastico_rigido', 'carton', 'papel',
          'aluminio', 'vidrio', 'metal', 'organico', 'otro'
        )
      `);
      await queryRunner.query(`
        CREATE TYPE "material_collections_unit_enum" AS ENUM ('kg', 'unidad', 'bulto')
      `);
      await queryRunner.query(`
        CREATE TABLE "material_collections" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "activity_id" uuid,
          "material" material_collections_material_enum NOT NULL,
          "quantity" integer NOT NULL,
          "unit" material_collections_unit_enum NOT NULL,
          "collected_at" timestamptz NOT NULL DEFAULT now(),
          "raw_material_product_id" uuid,
          "notes" text,
          "created_by" uuid,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "ck_collections_quantity_positive" CHECK ("quantity" > 0)
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "idx_collections_activity" ON "material_collections" ("activity_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_collections_product" ON "material_collections" ("raw_material_product_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX "idx_collections_created_by" ON "material_collections" ("created_by")`,
      );
      await queryRunner.query(
        `ALTER TABLE "material_collections" ADD CONSTRAINT "fk_collections_activity" FOREIGN KEY ("activity_id") REFERENCES "volunteer_activities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
      // La materia prima puede desaparecer del catalogo; la recoleccion se
      // conserva como historial y simplemente queda sin producto asociado.
      await queryRunner.query(
        `ALTER TABLE "material_collections" ADD CONSTRAINT "fk_collections_product" FOREIGN KEY ("raw_material_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `ALTER TABLE "material_collections" ADD CONSTRAINT "fk_collections_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "material_collections"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "material_collections_unit_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "material_collections_material_enum"`);
  }
}
