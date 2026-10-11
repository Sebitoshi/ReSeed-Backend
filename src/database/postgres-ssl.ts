/**
 * Configuracion de TLS para Postgres, compartida por la app y los scripts.
 *
 * Esta en un modulo aparte a proposit: data-source.ts importa todas las
 * entidades, y quien solo necesita el helper de SSL (scripts corriendos con
 * tsx) no deberia arrastrar ese costo ni sus requisitos de decoradores.
 */

/**
 * Devuelve `{ ssl: {...} }` si POSTGRES_SSL=true, o `{}` si no.
 *
 * Se usa con spread: `...postgresSslOptions()`.
 *
 * rejectUnauthorized:false valida que el trafico este cifrado sin verificar la
 * cadena de certificados del servidor. Aiven rota sus CA con frecuencia, y
 * exigir el certificado romperia la conexion cada vez que lo cambian.
 */
export function postgresSslOptions(): { ssl: { rejectUnauthorized: boolean } } | object {
  if (process.env.POSTGRES_SSL !== 'true') return {};
  return { ssl: { rejectUnauthorized: false } };
}
