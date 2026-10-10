import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductsCatalog1760000002000 implements MigrationInterface {
  name = 'ProductsCatalog1760000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "slug" varchar(140) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "parent_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_product_categories_slug" ON "product_categories" ("slug")`,
    );
    // Raiz oculta a la que cuelgan las categorias de primer nivel.
    await queryRunner.query(
      `INSERT INTO "product_categories" ("name", "slug", "is_active") VALUES ('Root', '__root__', false)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_categories" ADD CONSTRAINT "fk_product_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(180) NOT NULL,
        "description" text NOT NULL,
        "price_cents" integer NOT NULL,
        "stock" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "status" varchar(20) NOT NULL DEFAULT 'borrador',
        "category_id" uuid NOT NULL,
        "entrepreneur_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_products_entrepreneur" ON "products" ("entrepreneur_id")`);
    await queryRunner.query(`CREATE INDEX "idx_products_status" ON "products" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_products_category" ON "products" ("category_id")`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "fk_products_category" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "fk_products_entrepreneur" FOREIGN KEY ("entrepreneur_id") REFERENCES "entrepreneurs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "product_images" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "url" varchar(255) NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "is_primary" boolean NOT NULL DEFAULT true,
        "product_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_product_images_product" ON "product_images" ("product_id")`);
    await queryRunner.query(
      `ALTER TABLE "product_images" ADD CONSTRAINT "fk_product_images_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_images"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_categories"`);
  }
}
