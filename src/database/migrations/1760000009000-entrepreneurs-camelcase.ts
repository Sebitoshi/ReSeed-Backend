import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Alinea "entrepreneurs" con la entidad.
 *
 * La migracion Init creaba logo_url / contact_phone / contact_email /
 * review_note (snake_case), pero la entidad los declara sin `name` y por lo
 * tanto espera camelCase. Como no hay naming strategy configurada, TypeORM
 * consulta por logoUrl y la consulta fallia con:
 *
 *   column "logoUrl" of relation "entrepreneurs" does not exist
 *
 * El desajuste quedo oculto mientras la base local se genero con
 * synchronize=true (que si usa los nombres de propiedad) y Init se "adopto"
 * sin ejecutarse. Aparecio al apuntar a una base creada de cero por
 * migraciones.
 *
 * Renombra solo si detecta las columnas en snake_case, asi que es seguro
 * correrla tanto en bases afectadas como en las que ya estan bien.
 */
export class EntrepreneursCamelCase1760000009000 implements MigrationInterface {
  name = 'EntrepreneursCamelCase1760000009000';

  private async rename(
    queryRunner: QueryRunner,
    from: string,
    to: string,
  ): Promise<void> {
    const has = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='entrepreneurs' AND column_name=$1`,
      [from],
    );
    if (has.length === 0) return; // ya esta en camelCase o no existe
    await queryRunner.query(
      `ALTER TABLE "entrepreneurs" RENAME COLUMN "${from}" TO "${to}"`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.rename(queryRunner, 'logo_url', 'logoUrl');
    await this.rename(queryRunner, 'contact_phone', 'contactPhone');
    await this.rename(queryRunner, 'contact_email', 'contactEmail');
    await this.rename(queryRunner, 'review_note', 'reviewNote');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.rename(queryRunner, 'logoUrl', 'logo_url');
    await this.rename(queryRunner, 'contactPhone', 'contact_phone');
    await this.rename(queryRunner, 'contactEmail', 'contact_email');
    await this.rename(queryRunner, 'reviewNote', 'review_note');
  }
}
