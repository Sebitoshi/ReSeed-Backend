/**
 * Opciones del pool de conexiones a Postgres, compartidas por la app y los
 * scripts (migraciones).
 *
 * En serverless (Vercel) cada instancia levanta su propio pool: el default de
 * `pg` es 10 conexiones por proceso, y con varios arranques en frio la base
 * (Aiven) agota su cupo y la API empieza a responder 500 con:
 *   "remaining connection slots are reserved for roles with the SUPERUSER attribute"
 *
 * Un pool pequeno por instancia (y liberar las inactivas pronto) mantiene el
 * consumo bajo. Ajustable con la variable POSTGRES_POOL_MAX.
 */
export function postgresPoolOptions(): Record<string, unknown> {
  return {
    max: Number(process.env.POSTGRES_POOL_MAX ?? 3),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}
