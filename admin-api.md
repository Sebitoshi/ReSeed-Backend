# API de administración — Reseed

Referencia de los **55 endpoints reservados al rol `admin`**, con el proceso de acceso incluido.

La documentación interactiva, con esquemas de request y respuesta en vivo, está en
**`http://localhost:3000/docs`**. Este documento es la versión que se puede leer sin levantar el
servidor.

---

## 1. Crear el primer administrador

El rol `admin` **no se puede auto-asignar** al registrarse: `POST /auth/register` valida el campo
`role` contra una lista que no lo incluye. Se crea con el script incluido en el proyecto:

```bash
ADMIN_EMAIL=admin@tuempresa.com ADMIN_PASSWORD=secret123 pnpm exec tsx scripts/create-admin.ts
```

La contraseña debe tener al menos 8 caracteres. Si el correo ya existe, el script lo indica y no
duplica la cuenta.

---

## 2. Iniciar sesión

```bash
POST /auth/login
Content-Type: application/json

{ "email": "admin@tuempresa.com", "password": "secret123" }
```

Respuesta:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "8c91fbf4-...",
    "email": "admin@tuempresa.com",
    "name": "Admin",
    "role": "admin",
    "bio": null,
    "phone": null,
    "isActive": true,
    "emailVerifiedAt": "2026-10-11T23:46:12.738Z",
    "createdAt": "2026-10-11T23:31:00.000Z"
  }
}
```

### Errores posibles

| Código | Motivo |
|---|---|
| `401` | Contraseña incorrecta o correo inexistente. El mensaje es el mismo para ambos casos. |
| `401` | La cuenta está desactivada por un administrador. |
| `403` | La contraseña es correcta pero el correo nunca se verificó. |
| `429` | Demasiados intentos: el límite es **5 por minuto** por IP. |

> **Si la verificación de correo está activa**, una cuenta nueva no puede iniciar sesión hasta
> confirmar el código de 6 dígitos que llega por correo. El registro responde
> `requiresVerification: true` y no entrega token hasta que se use `POST /auth/verify-email`.

---

## 3. Usar el token

Se envía en cada petición:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Comprobación rápida de que el token y los permisos están bien:

```bash
GET /auth/admin/only
Authorization: Bearer <token>
```

Devuelve `200` con un saludo si el rol es `admin`, o `403` en caso contrario.

---

## 4. Comportamiento del token

Vale la pena saberlo antes de operar el panel:

- **Los cambios de rol y las desactivaciones surten efecto inmediato.** El token se valida contra
  la base de datos en cada petición, no solo al emitirse. No hace falta esperar a que venza.
- **Un token deja de servir si la persona cambia su contraseña**, aunque el token sea suyo y
  legítimo. Aplíquele a `POST /users/me/password` y a `POST /auth/reset-password`.
- **Vigencia de 7 días** por defecto, configurable con `JWT_EXPIRES_IN`.

---

## 5. Cómo leer las tablas de abajo

Cada endpoint trae su resumen, la descripción que deja el código, los parámetros de consulta y de
ruta, y el cuerpo de la petición con sus tipos y campos obligatorios.

**Paginación**: los listados aceptan `page` (desde 1) y `limit` (máximo 50) y responden siempre
con `items`, `total`, `page`, `limit` y `totalPages`.

---

## Empezar por aquí

### `GET /auth/admin/only`

**Ejemplo de endpoint solo-admin**

Requiere rol admin. Sirve como prueba de que el guard de roles funciona.


## Panel y reportes

### `GET /admin/overview`

**Resumen del panel (admin)**

Contadores globales: usuarios, emprendimientos, productos, campañas, voluntariados y dinero.

### `GET /admin/reports/activity`

**Reporte de actividad (admin)**

Series diarias de altas: usuarios, emprendimientos, productos, pagos, inscripciones y notificaciones.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `from` | string | no | Inicio del rango (ISO 8601). Por defecto: hace 30 días. |
| `to` | string | no | Fin del rango (ISO 8601). Por defecto: hoy. |
| `tz` | string | no | Zona horaria del reporte |

### `GET /admin/reports/users`

**Reporte de usuarios (admin)**

Altas por día y distribución por rol.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `from` | string | no | Inicio del rango (ISO 8601). Por defecto: hace 30 días. |
| `to` | string | no | Fin del rango (ISO 8601). Por defecto: hoy. |
| `tz` | string | no | Zona horaria del reporte |

### `GET /admin/reports/entrepreneurs`

**Reporte de emprendimientos (admin)**

Altas por día, estados y revisiones.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `from` | string | no | Inicio del rango (ISO 8601). Por defecto: hace 30 días. |
| `to` | string | no | Fin del rango (ISO 8601). Por defecto: hoy. |
| `tz` | string | no | Zona horaria del reporte |

### `GET /admin/reports/payments`

**Reporte de pagos (admin)**

Montos por estado, serie diaria y top emprendimientos.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `from` | string | no | Inicio del rango (ISO 8601). Por defecto: hace 30 días. |
| `to` | string | no | Fin del rango (ISO 8601). Por defecto: hoy. |
| `tz` | string | no | Zona horaria del reporte |

### `GET /admin/reports/volunteer`

**Reporte de voluntariados (admin)**

Inscripciones por día, estado y actividades mas pedidas.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `from` | string | no | Inicio del rango (ISO 8601). Por defecto: hace 30 días. |
| `to` | string | no | Fin del rango (ISO 8601). Por defecto: hoy. |
| `tz` | string | no | Zona horaria del reporte |


## Usuarios

### `GET /admin/users`

**Listar usuarios (admin)**

Paginado, con filtro por rol, estado y búsqueda.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `role` | `admin` \| `emprendedor` \| `comprador` \| `voluntario` | no | Filtra por rol |
| `q` | string | no | Búsqueda por nombre o email (parcial) |
| `isActive` | boolean | no | Filtra por cuenta activa (true) o desactivada (false) |

### `GET /admin/users/:id`

**Detalle de usuario (admin)**

Perfil mas un resumen de su actividad.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `PATCH /admin/users/:id/role`

**Cambiar rol (admin)**

Aplica de inmediato: el JWT se valida contra la base en cada request.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `role` | `admin` \| `emprendedor` \| `comprador` \| `voluntario` | **sí** | `"emprendedor"` |
| | | _Nuevo rol del usuario_ | |

### `PATCH /admin/users/:id/status`

**Activar o desactivar cuenta (admin)**

Una cuenta desactivada no puede iniciar sesión ni usar su token.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `isActive` | boolean | **sí** | `false` |
| | | _false desactiva la cuenta (bloquea login y JWT); true la reactiva_ | |
| `reason` | string | no | — |
| | | _Motivo registrado en el asunto_ | |


## Revisión de fichas de socios

### `GET /entrepreneurs/admin/review`

**Cola de revision (admin)**

Lista paginada de solicitudes, con filtros por estado y propietario.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `status` |  | no | Filtra solicitudes por estado de revision |
| `ownerId` | string | no | Filtra por el propietario de la ficha |

### `POST /entrepreneurs/:id/approve`

**Aprobar ficha (admin)**

La ficha pasa a "aprobado" y aparece en el directorio.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `note` | string | no | `"Bienvenido a la plataforma"` |
| | | _Nota de la revision. Obligatoria para rechazar y suspender._ | |

### `POST /entrepreneurs/:id/reject`

**Rechazar ficha (admin)**

Requiere motivo (note). No se puede rechazar una ya aprobada.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `note` | string | no | `"Bienvenido a la plataforma"` |
| | | _Nota de la revision. Obligatoria para rechazar y suspender._ | |

### `POST /entrepreneurs/:id/suspend`

**Suspender ficha (admin)**

Requiere motivo. La ficha deja de verse en el directorio.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `note` | string | no | `"Bienvenido a la plataforma"` |
| | | _Nota de la revision. Obligatoria para rechazar y suspender._ | |

### `POST /entrepreneurs/:id/restore`

**Restaurar ficha archivada (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `DELETE /entrepreneurs/:id`

**Archivar ficha (admin)**

Soft-delete: no borra el registro, lo archiva para poder restaurarlo luego.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `GET /entrepreneurs/admin/archived`

**Bandeja de archivados (admin)**

Fichas con soft-delete, restaurables.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |


## Moderación de productos

### `GET /admin/moderation/products`

**Moderar productos (admin)**

Todos los productos (cualquier estado, incluidos borradores) con su emprendimiento.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `status` | `borrador` \| `publicado` \| `despublicado` | no | Filtra por estado de publicación |
| `q` | string | no | Búsqueda por nombre o descripción |
| `includeArchived` | boolean | no | Incluye tambien los archivados (soft-delete) |

### `POST /admin/moderation/products/:id/unpublish`

**Despublicar producto (admin)**

Lo saca del catalogo publico.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /admin/moderation/products/:id/restore`

**Restaurar producto archivado (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |


## Jornadas de limpieza

### `GET /volunteer`

**Listar voluntariados (admin)**

Todos los estados, con cupos tomados.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `status` | `borrador` \| `abierta` \| `cerrada` \| `finalizada` | no | Filtra por estado (solo admin) |

### `POST /volunteer`

**Crear voluntariado (admin)**

Nace en estado "borrador"; se abre al publico con POST /:id/open.

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `title` | string | **sí** | `"Jornada de limpieza del humedal"` |
| `description` | string | **sí** | — |
| | | _Que se hace, a quien ayuda y que deben llevar_ | |
| `location` | string | no | `"Parque La Esperanza, Bogota"` |
| `startsAt` | string | **sí** | — |
| | | _Fecha y hora de inicio (ISO 8601)_ | |
| `endsAt` | string | no | — |
| | | _Fin (ISO 8601)_ | |
| `slots` | number | no | `20` |
| | | _Cupos disponibles; omitir para ilimitado_ | |
| `imageUrl` | string | no | — |
| | | _Imagen de portada (URL)_ | |

### `PATCH /volunteer/:id`

**Editar voluntariado (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `title` | string | no | — |
| `description` | string | no | — |
| `location` | string | no | — |
| `startsAt` | string | no | — |
| `endsAt` | string | no | — |
| `slots` | number | no | — |
| `imageUrl` | string | no | — |

### `POST /volunteer/:id/open`

**Abrir inscripciones (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /volunteer/:id/close`

**Cerrar inscripciones (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /volunteer/:id/finish`

**Marcar como finalizada (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `DELETE /volunteer/:id`

**Archivar voluntariado (admin)**

Soft-delete; se puede restaurar.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /volunteer/:id/restore`

**Restaurar voluntariado archivado (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `GET /volunteer/admin/archived`

**Voluntariados archivados (admin)**

Soft-delete, restaurables.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `status` | `borrador` \| `abierta` \| `cerrada` \| `finalizada` | no | Filtra por estado (solo admin) |


## Material recolectado

### `POST /volunteer/admin/activities/:id/collections`

**Registrar material recolectado en una jornada (admin)**

Cantidad en la unidad base: gramos si unit=kg, piezas si unit=unidad. Usa rawMaterialProductId para cerrar la traza hasta la materia prima.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** | Id de la jornada |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `material` | `pet` \| `plastico_filme` \| `plastico_rigido` \| `carton` \| `papel` \| `aluminio` \| `vidrio` \| `metal` \| `organico` \| `otro` | **sí** | — |
| | | _Tipo de material recolectado_ | |
| `quantity` | number | **sí** | `25000` |
| | | _Cantidad en la unidad base: gramos si unit=kg, piezas si unit=unidad, bultos si unit=bulto. Ej. 25000 = 25 kg._ | |
| `unit` | `kg` \| `unidad` \| `bulto` | **sí** | — |
| | | _Unidad de medida de la cantidad_ | |
| `collectedAt` | string | no | — |
| | | _Fecha real de la recolección (ISO 8601). Por defecto, ahora._ | |
| `rawMaterialProductId` | string | no | — |
| | | _Producto de materia prima en el que se transformo; cierra la traza jornada -> material -> materia prima. Requiere el id de un producto._ | |
| `notes` | string | no | — |
| | | _Observaciones: calidad, humedad, incidencias._ | |

### `GET /volunteer/admin/collections`

**Recolecciones (admin)**

Listado con filtros por material, jornada, producto de materia prima y rango de fechas. Envia rawMaterialProductId=none para ver las aun sin transformar.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `material` | `pet` \| `plastico_filme` \| `plastico_rigido` \| `carton` \| `papel` \| `aluminio` \| `vidrio` \| `metal` \| `organico` \| `otro` | no | Filtra por tipo de material |
| `activityId` | string | no | Filtra por actividad (jornada) |
| `rawMaterialProductId` | string | no | Filtra por producto de materia prima al que quedo vinculado. Envia "none" para ver las recolecciones aun sin transformar. |
| `from` | string | no | Inicia el rango de fechas (ISO 8601) |
| `to` | string | no | Termina el rango de fechas (ISO 8601) |

### `PATCH /volunteer/admin/collections/:id`

**Editar una recolección (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `material` | `pet` \| `plastico_filme` \| `plastico_rigido` \| `carton` \| `papel` \| `aluminio` \| `vidrio` \| `metal` \| `organico` \| `otro` | no | — |
| `quantity` | number | no | — |
| | | _Cantidad en la unidad base (ver CreateCollectionDto)_ | |
| `unit` | `kg` \| `unidad` \| `bulto` | no | — |
| `collectedAt` | string | no | — |
| | | _Fecha de la recolección (ISO 8601)_ | |
| `rawMaterialProductId` | string | no | — |
| | | _Vincula con un producto de materia prima_ | |
| `notes` | string | no | — |
| | | _Observaciones_ | |

### `DELETE /volunteer/admin/collections/:id/unlink`

**Desvincular una recolección de su materia prima (admin)**

La recolección pasa a "sin transformar"; el registro se conserva.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `GET /volunteer/admin/collections/summary`

**Resumen de material recolectado (admin)**

Totales agregados por tipo de material y unidad, con filtros de fechas.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `material` | `pet` \| `plastico_filme` \| `plastico_rigido` \| `carton` \| `papel` \| `aluminio` \| `vidrio` \| `metal` \| `organico` \| `otro` | no | Filtra por tipo de material |
| `activityId` | string | no | Filtra por actividad (jornada) |
| `rawMaterialProductId` | string | no | Filtra por producto de materia prima al que quedo vinculado. Envia "none" para ver las recolecciones aun sin transformar. |
| `from` | string | no | Inicia el rango de fechas (ISO 8601) |
| `to` | string | no | Termina el rango de fechas (ISO 8601) |


## Inscripciones a jornadas

### `GET /volunteer/admin/signups`

**Inscripciones (admin)**

Bandeja de inscripciones con el estado y los datos del voluntario.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `status` | `pendiente` \| `confirmado` \| `rechazado` \| `cancelado` | no | Filtra por estado de inscripción |
| `activityId` | string | no | Filtra por actividad |

### `POST /volunteer/signups/:id/confirm`

**Confirmar inscripción (admin)**

La inscripción pasa a "confirmado" y el voluntario recibe el correo de confirmación.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `note` | string | no | — |
| | | _Motivo (obligatorio al rechazar)_ | |

### `POST /volunteer/signups/:id/reject`

**Rechazar inscripción (admin)**

Requiere motivo (note).

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `note` | string | no | — |
| | | _Motivo (obligatorio al rechazar)_ | |


## Campañas

### `GET /campaigns`

**Listar campañas (admin)**

Todas las campañas con su estado de revision, filtrables por estado.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `status` | `borrador` \| `activa` \| `finalizada` | no | Filtra por estado (solo admin) |

### `POST /campaigns`

**Crear campaña (admin)**

Nace en estado "borrador"; no se ve en el listado publico hasta publicarla.

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `title` | string | **sí** | `"Semana de la Miel Solidaria"` |
| `summary` | string | no | — |
| | | _Frase corta que aparece en el listado publico_ | |
| `description` | string | **sí** | — |
| | | _Descripcion completa de la campana_ | |
| `imageUrl` | string | no | — |
| | | _Imagen de portada (URL)_ | |
| `goalCents` | number | no | `5000000` |
| | | _Meta de recaudo en centavos_ | |
| `donationUrl` | string | no | — |
| | | _Link externo para donar_ | |
| `startsAt` | string | no | — |
| | | _Inicio de vigencia (ISO 8601)_ | |
| `endsAt` | string | no | — |
| | | _Fin de vigencia (ISO 8601)_ | |

### `GET /campaigns/:id`

**Detalle de campaña (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `PATCH /campaigns/:id`

**Editar campaña (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `title` | string | no | — |
| `summary` | string | no | — |
| `description` | string | no | — |
| `imageUrl` | string | no | — |
| `goalCents` | number | no | — |
| `donationUrl` | string | no | — |
| `startsAt` | string | no | — |
| `endsAt` | string | no | — |

### `POST /campaigns/:id/publish`

**Publicar campaña (admin)**

Pasa a "activa" y aparece en el listado publico.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /campaigns/:id/close`

**Finalizar campaña (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /campaigns/:id/notify`

**Difundir campaña por correo (admin)**

Envia la campaña a todos los usuarios activos por SMTP y registra cada envío en el historial de notificaciones.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `DELETE /campaigns/:id`

**Archivar campaña (admin)**

Soft-delete; se puede restaurar.

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /campaigns/:id/restore`

**Restaurar campaña archivada (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `GET /campaigns/admin/archived`

**Campañas archivadas (admin)**

Soft-delete, restaurables.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `status` | `borrador` \| `activa` \| `finalizada` | no | Filtra por estado (solo admin) |


## Pagos

### `GET /payments/admin/list`

**Listar todos los pagos (admin)**

Bandera global de pagos con filtros, solo para administradores.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) |
| `limit` | number | no | Elementos por página (maximo 50) |
| `status` | `pendiente` \| `aprobado` \| `rechazado` \| `reembolsado` \| `cancelado` | no | Filtra por estado del pago |


## Notificaciones

### `GET /notifications/admin/list`

**Log de notificaciones (admin)**

Todas las notificaciones enviadas, fallidas u omitidas, con filtros.

**Parámetros de consulta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `page` | number | no | Número de página (empieza en 1) (por defecto `1`) |
| `limit` | number | no | Cantidad de resultados por página (maximo 50) (por defecto `12`) |
| `type` | `registro` \| `verificacion` \| `pago` \| `reembolso` \| `emprendimiento` \| `voluntariado` \| `campana` \| `sistema` | no | Filtra por tipo de notificación |
| `email` | string | no | Filtra por email destino (parcial) |

### `GET /notifications/admin/stats`

**Estadisticas de notificaciones (admin)**

### `GET /notifications/admin/smtp`

**Estado del SMTP (admin)**

Indica si el servidor tiene Gmail SMTP configurado y habilitado.

### `POST /notifications/admin/test`

**Enviar correo de prueba (admin)**

Verifica la conexion con Gmail y envia un correo al admin autenticado.

### `POST /notifications/admin/:id/resend`

**Reenviar una notificación (admin)**

**Parámetros de ruta**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | **sí** |  |

### `POST /admin/notifications/broadcast`

**Enviar correo a todos los usuarios (admin)**

Difusion general por SMTP; cada envío queda registrado en el historial.

**Cuerpo**

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `subject` | string | **sí** | — |
| | | _Asunto del correo_ | |
| `message` | string | **sí** | `"Este domingo hay feria de emprendimientos en el parque central."` |
| | | _Cuerpo en texto plano; se convierte a un correo HTML con el layout de la plataforma_ | |
| `link` | string | no | — |
| | | _Enlace opcional agregado al final del correo_ | |



---

## Notas operativas

### El correo se puede cortar sin romper nada

Si `SMTP_USER` o `SMTP_PASS` están vacíos, o `SMTP_ENABLED=false`, la API **sigue funcionando con
normalidad**: cada notificación queda registrada en la base con estado `omitida` en lugar de
enviarse. El estado de la configuración se consulta con `GET /notifications/admin/smtp`.

Para validar la configuración sin esperar a un evento real, `POST /notifications/admin/test`
envía un correo de prueba al administrador.

### La difusión de campañas es secuencial

`POST /admin/notifications/broadcast` y `POST /campaigns/:id/notify` envían los correos **uno por
uno**, en el momento de la petición. Con el SMTP configurado y una base de usuarios grande, la
petición va a agotar el tiempo de espera antes de terminar. No está encolado.

Teniendo en cuenta que Gmail limita a **~500 correos por día** con la cuenta configurada, conviene
usar la difusión sobre segmentos acotados.

### Desactivar una cuenta vs. suspender una ficha

Son dos cosas distintas y conviene no confundirlas:

| Acción | Efecto | Endpoint |
|---|---|---|
| Desactivar cuenta | La persona no puede iniciar sesión ni usar su token. Su ficha y sus productos siguen existiendo. | `PATCH /admin/users/:id/status` |
| Suspender ficha | La ficha deja de mostrarse en el directorio público. La persona conserva su cuenta. | `POST /entrepreneurs/:id/suspend` |

### Nada se borra

`DELETE` en fichas, productos, campañas y jornadas **archiva**, no elimina: mueve el registro a la
bandeja de archivados (`.../admin/archived`) y se puede restaurar con `POST .../restore`. La única
excepción es `DELETE /volunteer/admin/collections/:id/unlink`, que **sí borra** la recolección
pero solo desvincula el material de su producto de materia prima cuando el vínculo existe.

### Trazabilidad de punta a punta

La cadena que conecta el trabajo de la comunidad con la venta se recorre así:

| Paso | Endpoint |
|---|---|
| La jornada recolecta material | `POST /volunteer/admin/activities/:id/collections` |
| Se consulta lo recolectado | `GET /volunteer/admin/collections` |
| Se ve el total por material | `GET /volunteer/admin/collections/summary` |
| Se consulta el producto de materia prima en el que se convirtió | `GET /products/public/:id` |
| Se ve qué jornadas lo produjeron | `GET /volunteer/public/:id/collections` |

`GET /volunteer/admin/collections` admite el filtro `rawMaterialProductId` para responder la
pregunta inversa: *¿qué recolecciones alimentaron este producto?* El valor especial `none` trae
las que todavía no están vinculadas a ningún producto.
