# Reseed — contexto del proyecto

Reseed es una plataforma que conecta **jornadas de limpieza** con **talleres artesanales locales**.

La idea es simple: la comunidad sale a recoger reciclables, ese material se transforma en
materia prima y se vende a los **socios**, que son los artesanos de la comunidad. Los socios
fabrican productos artesanales con esa materia prima y los publican aquí. El público los compra.

Lo que distingue al proyecto es que **nada se pierde por el camino**: cada recolección queda
ligada al producto de materia prima en el que se convirtió, y ese producto a las artesanías que
salieron de él.

---

## El ciclo

```
   JORNADA DE LIMPIEZA              TRANSFORMACIÓN              TALLER
  ─────────────────────            ─────────────────          ─────────────
  Los voluntarios van              El material se             El socio compra
  al punto de encuentro   ───►     procesa y se      ───►    la materia prima
  y recolectan reciclables.        publica como               y fabrica la
  Queda registrado qué            producto de                 artesanía.
  y cuánto se recolectó.           materia prima.
                                                              │
                                                              ▼
                                                        ┌───────────┐
                                                        │  CATÁLOGO │
                                                        │  PÚBLICO  │
                                                        └───────────┘
```

La traza que lo sostiene:

```
  Jornada ──► Recolectado ──► Materia prima ──► Artesanía ──► Venta
              (PET, 45 kg)    (producto)        (producto)
```

Una consulta inversa permite responder *"¿de qué jornada salió el PET de esta artesanía?"* sin
abrir la base a mano.

---

## Roles

| Rol | Qué hace |
|---|---|
| 🌱 **Voluntario** | Se inscribe a las jornadas de limpieza y va a recolectar. |
| 🎨 **Socio / Emprendedor** | Compra materia prima, fabrica productos artesanales y los publica. |
| 🛒 **Comprador** | Explora el catálogo y compra productos terminados. |
| 🛡️ **Administrador** | Publica jornadas, registra lo recolectado, aprueba fichas y modera todo. |

El rol `admin` **no se puede auto-asignar** al registrarse: se crea con `scripts/create-admin.ts`.

Toda ficha de socio y todo producto **empieza en borrador** y solo se publica cuando un
administrador lo aprueba. Nada llega al público sin pasar por un humano.

---

## Cómo está hecho

| | |
|---|---|
| Framework | NestJS (TypeScript, ESM) |
| Base de datos | PostgreSQL + TypeORM |
| Autenticación | JWT (passport) + guard de roles |
| Correo | Nodemailer sobre SMTP de Gmail |
| Documentación | Swagger en `/docs` |
| Tests | Vitest (unitarios) + supertest (e2e) |

**10 módulos**, **105 endpoints**, **13 tablas**, **12 migraciones**.

| Módulo | Qué cubre |
|---|---|
| `auth` | Registro, verificación de correo, login, recuperación de contraseña |
| `users` | Perfil, cambio de contraseña |
| `entrepreneurs` | Fichas de socios, su aprobación y su historial |
| `products` | Catálogo de productos (materia prima y artesanías) |
| `product-categories` | Árbol de categorías |
| `payments` | Checkout, webhooks, reembolsos |
| `notifications` | Historial de correos y envíos |
| `campaigns` | Campañas solidarias y su difusión |
| `volunteer` | Jornadas de limpieza, inscripciones y material recolectado |
| `admin` | Panel: usuarios, moderación, reportes |

---

## Base de datos

| Tabla | Contenido |
|---|---|
| `users` | Cuentas, con verificación de correo y control de contraseñas |
| `entrepreneurs` | Fichas de los socios y su estado de revisión |
| `entrepreneur_status_logs` | Quién aprobó, rechazó o suspendió, cuándo y por qué |
| `products` | Materia prima y artesanías (se distinguen por categoría) |
| `product_categories` | Árbol de categorías |
| `product_images` | Imágenes de cada producto |
| `payments` / `payment_refunds` | Pagos y reembolsos |
| `notifications` | Cada correo enviado, con su estado |
| `campaigns` | Campañas solidarias |
| `volunteer_activities` | Jornadas de limpieza |
| `volunteer_signups` | Inscripciones a cada jornada |
| `material_collections` | Qué se recolectó en cada jornada y a qué producto se vinculó |

**Las migraciones son la única fuente de verdad del esquema.** `TYPEORM_SYNCHRONIZE` está en
`false` y no debe encenderse en producción.

### Convención de cantidades

Las cantidades se guardan como **enteros en la unidad base** — gramos cuando la unidad es `kg`,
piezas en los demás casos. Así se evitan los errores de coma flotante que produce sumar
decimales. La API entrega además un `quantityLabel` legible (`"45 kg"`), calculado al vuelo.

### Borrado lógico

`entrepreneurs`, `products`, `campaigns` y `volunteer_activities` usan `deletedAt`. Nunca se
borra nada: se archiva y se puede restaurar.

---

## Convenciones que conviene conocer

**El esquema camelCase, las migraciones snake_case — pero la entidad manda.** TypeORM no tiene
naming strategy configurada, así que consulta por los nombres de propiedad. Las columnas que no
declaran `name` explícito van en camelCase. `1760000009000` corrigió cuatro que Init creaba mal.

**Los correos nunca rompen nada.** Todo envío es *best effort*: se guarda el registro en la base
y luego se intenta mandar. Si el SMTP falla, la notificación queda como `fallida` y el flujo que
la desencadenó continúa normal.

**El JWT se valida contra la base en cada request.** No se confía en el payload: un cambio de rol
o una cuenta desactivada surten efecto inmediato. El costo es un `SELECT` por petición
autenticada. `password_changed_at` se usa además para descartar tokens anteriores a un cambio de
contraseña.

**Cantidades en la respuesta vs. en la base.** La API pagina siempre igual: `page`, `limit` (máx
50), y responde `items`, `total`, `page`, `limit`, `totalPages`.

---

## Autenticación

Los endpoints públicos sin sesión son los 19 marcados `Público` en la tabla de abajo. Para el
resto se envía el token en cada petición:

```
Authorization: Bearer <accessToken>
```

### Registrar y verificar el correo

```bash
# 1. Registrar. No entrega token todavia.
POST /auth/register
{ "email": "ana@correo.com", "password": "clave123", "name": "Ana" }
# -> { "user": {...}, "requiresVerification": true, "verificationExpiresInMinutes": 15 }

# 2. Confirmar el codigo recibido por correo. Ahi si entrega token.
POST /auth/verify-email
{ "email": "ana@correo.com", "code": "482913" }
# -> { "user": {...}, "accessToken": "eyJhbGci..." }

# 3. Si el codigo no llego, pedir otro (espera de 60 segundos).
POST /auth/resend-verification
{ "email": "ana@correo.com" }
```

### Recuperar la contraseña

```bash
POST /auth/forgot-password
{ "email": "ana@correo.com" }
# -> { "reenviado": true, "mensaje": "Si ese correo tiene una cuenta, ..." }

POST /auth/reset-password
{ "email": "ana@correo.com", "code": "482913", "password": "ClaveNueva123" }
# -> { "restablecida": true, "mensaje": "Contrasena actualizada. Inicia sesion con la nueva clave." }
```

Al cambiar la contraseña **se cierran las demás sesiones**: los tokens emitidos antes dejan de
servir.

### Detalles de seguridad

| | Verificación de correo | Recuperación de contraseña |
|---|---|---|
| Código | 6 dígitos, hasheado con bcrypt | 6 dígitos, hasheado con bcrypt |
| Vigencia | 15 minutos | 15 minutos |
| Intentos | 5 por código | 5 por código |
| Entre envíos | 60 segundos | 60 segundos |
| Columnas | `verification_*` | `password_reset_*` |

El código en claro **nunca se guarda**: solo su hash, y el texto viaja por el correo.

Ambos flujos responden de forma **neutra**: no revelan si un correo está registrado ni si ya fue
verificado.

`login` devuelve **403** si el correo no está verificado y **401** si la contraseña es incorrecta.
Que el código de estado los distinga permite redirigir al formulario adecuado sin parsear texto.

La verificación se salta cuando el SMTP está deshabilitado o `REQUIRE_EMAIL_VERIFICATION=false`:
exigirla sin forma de entregar el código dejaría a todo el mundo sin poder registrarse.

---

## Endpoints

**105 endpoints**: 19 públicos, 31 que requieren token y 55 reservados a administradores.

La lista fue generada desde el código fuente y contrastada contra el documento OpenAPI: coinciden
en los 105. La documentación interactiva, con esquemas de request y respuesta, está en **`/docs`**.

> **Sobre la columna "Token".** Marca que no hay restricción de rol, no que cualquier usuario vea
> todo. Varios de esos endpoints filtran por propiedad dentro del servicio: `GET
> /entrepreneurs/:id/history`, por ejemplo, lanza `403` si la ficha no es tuya y no eres admin.
> Lo mismo aplica a `/products/mine`, `/volunteer/mine`, `/payments/mine` y `/notifications/mine`.

#### Autenticación — `/auth`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| GET | `/auth/admin/only` | Ejemplo de endpoint solo-admin | **Admin** |
| POST | `/auth/forgot-password` | Pedir un codigo para recuperar la contrasena | Público |
| POST | `/auth/login` | Iniciar sesion | Público |
| POST | `/auth/register` | Registrar un usuario nuevo | Público |
| POST | `/auth/resend-verification` | Reenviar el codigo de verificacion | Público |
| POST | `/auth/reset-password` | Cambiar la contrasena con el codigo recibido | Público |
| GET | `/auth/roles` | Listar roles disponibles | Público |
| POST | `/auth/verify-email` | Confirmar el correo con el codigo de 6 digitos | Público |

#### Usuarios — `/users`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| GET | `/users/me` | Obtener mi perfil | Token |
| PATCH | `/users/me` | Actualizar mi perfil | Token |
| POST | `/users/me/password` | Cambiar mi contrasena | Token |
| GET | `/users/roles` | Listar roles disponibles (autenticado) | Token |

#### Emprendimientos — `/entrepreneurs`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| POST | `/entrepreneurs` | Solicitar publicacion de un emprendimiento | Token |
| GET | `/entrepreneurs/:id` | Ver una ficha (dueño o admin) | Token |
| PATCH | `/entrepreneurs/:id` | Editar la ficha | Token |
| DELETE | `/entrepreneurs/:id` | Archivar ficha (admin) | **Admin** |
| POST | `/entrepreneurs/:id/approve` | Aprobar ficha (admin) | **Admin** |
| GET | `/entrepreneurs/:id/history` | Historial de auditoria | Token |
| POST | `/entrepreneurs/:id/reject` | Rechazar ficha (admin) | **Admin** |
| POST | `/entrepreneurs/:id/restore` | Restaurar ficha archivada (admin) | **Admin** |
| POST | `/entrepreneurs/:id/resubmit` | Reenviar a revision | Token |
| POST | `/entrepreneurs/:id/suspend` | Suspender ficha (admin) | **Admin** |
| GET | `/entrepreneurs/admin/archived` | Bandeja de archivados (admin) | **Admin** |
| GET | `/entrepreneurs/admin/review` | Cola de revision (admin) | **Admin** |
| GET | `/entrepreneurs/mine` | Mis emprendimientos | Token |
| GET | `/entrepreneurs/public` | Directorio publico de emprendimientos | Público |
| GET | `/entrepreneurs/public/:slug` | Perfil publico por slug | Público |

#### Productos — `/products`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| POST | `/products` | Crear un producto (borrador) | Token |
| GET | `/products/:id` | Ver un producto (dueño o admin) | Token |
| PATCH | `/products/:id` | Editar un producto | Token |
| DELETE | `/products/:id` | Eliminar un producto (borrado logico) | Token |
| POST | `/products/:id/publish` | Publicar un producto | Token |
| POST | `/products/:id/unpublish` | Despublicar un producto | Token |
| GET | `/products/mine` | Mis productos | Token |
| GET | `/products/public` | Catalogo publico de productos | Público |
| GET | `/products/public/:id` | Detalle publico de un producto | Público |

#### Categorías de productos — `/product-categories`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| POST | `/product-categories` | Crear categoria (admin) | Token |
| PATCH | `/product-categories/:id` | Editar categoria (admin) | Token |
| DELETE | `/product-categories/:id` | Desactivar categoria (admin) | Token |
| GET | `/product-categories/public/counts` | Conteo de productos por categoria (publico) | Público |
| GET | `/product-categories/public/tree` | Arbol de categorias (publico) | Público |

#### Pagos — `/payments`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| GET | `/payments/:id` | Ver un pago | Token |
| POST | `/payments/:id/refund` | Solicitar reembolso (total o parcial) | Token |
| GET | `/payments/:id/refunds` | Listar reembolsos de un pago | Token |
| GET | `/payments/admin/list` | Listar todos los pagos (admin) | **Admin** |
| POST | `/payments/checkout` | Crear intencion de pago (checkout hosted) | Token |
| GET | `/payments/mine` | Mis pagos | Token |
| POST | `/payments/webhook/:gateway` | Webhook de la pasarela (publico) | Público |

#### Notificaciones — `/notifications`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| POST | `/notifications/:id/read` | Marcar una notificacion como leida | Token |
| POST | `/notifications/admin/:id/resend` | Reenviar una notificacion (admin) | **Admin** |
| GET | `/notifications/admin/list` | Log de notificaciones (admin) | **Admin** |
| GET | `/notifications/admin/smtp` | Estado del SMTP (admin) | **Admin** |
| GET | `/notifications/admin/stats` | Estadisticas de notificaciones (admin) | **Admin** |
| POST | `/notifications/admin/test` | Enviar correo de prueba (admin) | **Admin** |
| GET | `/notifications/mine` | Mi historial de notificaciones | Token |
| GET | `/notifications/unread-count` | Conteo de notificaciones no leidas | Token |

#### Campañas — `/campaigns`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| GET | `/campaigns` | Listar campanas (admin) | **Admin** |
| POST | `/campaigns` | Crear campana (admin) | **Admin** |
| GET | `/campaigns/:id` | Detalle de campana (admin) | **Admin** |
| PATCH | `/campaigns/:id` | Editar campana (admin) | **Admin** |
| DELETE | `/campaigns/:id` | Archivar campana (admin) | **Admin** |
| POST | `/campaigns/:id/close` | Finalizar campana (admin) | **Admin** |
| POST | `/campaigns/:id/notify` | Difundir campana por correo (admin) | **Admin** |
| POST | `/campaigns/:id/publish` | Publicar campana (admin) | **Admin** |
| POST | `/campaigns/:id/restore` | Restaurar campana archivada (admin) | **Admin** |
| GET | `/campaigns/admin/archived` | Campanas archivadas (admin) | **Admin** |
| GET | `/campaigns/public` | Campanas publicas | Público |
| GET | `/campaigns/public/:slug` | Detalle publico de una campana por slug | Público |

#### Voluntariados y jornadas — `/volunteer`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| GET | `/volunteer` | Listar voluntariados (admin) | **Admin** |
| POST | `/volunteer` | Crear voluntariado (admin) | **Admin** |
| PATCH | `/volunteer/:id` | Editar voluntariado (admin) | **Admin** |
| DELETE | `/volunteer/:id` | Archivar voluntariado (admin) | **Admin** |
| POST | `/volunteer/:id/close` | Cerrar inscripciones (admin) | **Admin** |
| POST | `/volunteer/:id/finish` | Marcar como finalizada (admin) | **Admin** |
| POST | `/volunteer/:id/open` | Abrir inscripciones (admin) | **Admin** |
| POST | `/volunteer/:id/restore` | Restaurar voluntariado archivado (admin) | **Admin** |
| POST | `/volunteer/:id/signup` | Inscribirme a un voluntariado | Token |
| DELETE | `/volunteer/:id/signup` | Cancelar mi inscripcion | Token |
| POST | `/volunteer/admin/activities/:id/collections` | Registrar material recolectado en una jornada (admin) | **Admin** |
| GET | `/volunteer/admin/archived` | Voluntariados archivados (admin) | **Admin** |
| GET | `/volunteer/admin/collections` | Recolecciones (admin) | **Admin** |
| PATCH | `/volunteer/admin/collections/:id` | Editar una recoleccion (admin) | **Admin** |
| DELETE | `/volunteer/admin/collections/:id/unlink` | Desvincular una recoleccion de su materia prima (admin) | **Admin** |
| GET | `/volunteer/admin/collections/summary` | Resumen de material recolectado (admin) | **Admin** |
| GET | `/volunteer/admin/signups` | Inscripciones (admin) | **Admin** |
| GET | `/volunteer/mine` | Mis inscripciones a voluntariados | Token |
| GET | `/volunteer/public` | Voluntariados abiertos (publico) | Público |
| GET | `/volunteer/public/:id` | Detalle publico de un voluntariado | Público |
| GET | `/volunteer/public/:id/collections` | Materiales recolectados en una jornada (publico) | Público |
| POST | `/volunteer/signups/:id/confirm` | Confirmar inscripcion (admin) | **Admin** |
| POST | `/volunteer/signups/:id/reject` | Rechazar inscripcion (admin) | **Admin** |

#### Administración — `/admin`

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| GET | `/admin/moderation/products` | Moderar productos (admin) | **Admin** |
| POST | `/admin/moderation/products/:id/restore` | Restaurar producto archivado (admin) | **Admin** |
| POST | `/admin/moderation/products/:id/unpublish` | Despublicar producto (admin) | **Admin** |
| POST | `/admin/notifications/broadcast` | Enviar correo a todos los usuarios (admin) | **Admin** |
| GET | `/admin/overview` | Resumen del panel (admin) | **Admin** |
| GET | `/admin/reports/activity` | Reporte de actividad (admin) | **Admin** |
| GET | `/admin/reports/entrepreneurs` | Reporte de emprendimientos (admin) | **Admin** |
| GET | `/admin/reports/payments` | Reporte de pagos (admin) | **Admin** |
| GET | `/admin/reports/users` | Reporte de usuarios (admin) | **Admin** |
| GET | `/admin/reports/volunteer` | Reporte de voluntariados (admin) | **Admin** |
| GET | `/admin/users` | Listar usuarios (admin) | **Admin** |
| GET | `/admin/users/:id` | Detalle de usuario (admin) | **Admin** |
| PATCH | `/admin/users/:id/role` | Cambiar rol (admin) | **Admin** |
| PATCH | `/admin/users/:id/status` | Activar o desactivar cuenta (admin) | **Admin** |


---

## Configuración

Las variables tienen valores por defecto para desarrollo local, excepto las de correo.

| Variable | Por defecto | Descripción |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | Host de PostgreSQL |
| `POSTGRES_PORT` | `5432` | Puerto |
| `POSTGRES_USER` | `reseed` | Usuario |
| `POSTGRES_PASSWORD` | `reseed` | Contraseña |
| `POSTGRES_DB` | `reseed` | Base de datos |
| `POSTGRES_SSL` | `false` | `true` para servidores gestionados que exigen TLS (Aiven) |
| `JWT_SECRET` | `dev-secret` | **Obligatorio en producción.** |
| `JWT_EXPIRES_IN` | `7d` | Vigencia del token |
| `PORT` | `3000` | Puerto del servidor |
| `APP_URL` | `http://localhost:3000` | URL pública; la usan los botones de los correos |
| `TYPEORM_SYNCHRONIZE` | `false` | **Nunca `true` en producción.** |
| `REQUIRE_EMAIL_VERIFICATION` | `true` | Exige el código de 6 dígitos al registrarse |

### Correo (SMTP de Gmail)

| Variable | Por defecto | Descripción |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor |
| `SMTP_PORT` | `587` | Puerto |
| `SMTP_SECURE` | `false` | `true` solo con puerto 465 |
| `SMTP_USER` | *(vacío)* | Correo de Gmail |
| `SMTP_PASS` | *(vacío)* | Contraseña de aplicación, 16 caracteres sin espacios |
| `SMTP_FROM_NAME` | `Reseed` | Nombre visible del remitente |
| `SMTP_ENABLED` | `true` | `false` corta los envíos sin borrar credenciales |

Para las credenciales hay que activar la verificación en dos pasos de Google y generar una
**contraseña de aplicación** desde <https://myaccount.google.com/apppasswords>. La contraseña
normal de Google no sirve.

**Si el correo no está configurado, nada se rompe**: las notificaciones quedan registradas en la
base con estado `omitida` y la API responde con normalidad.

---

## Cómo levantarlo

```bash
# 1. Dependencias
pnpm install

# 2. Configurar
cp .env.example .env
# ... editar .env

# 3. Esquema
pnpm run migration:run

# 4. Primer administrador
ADMIN_EMAIL=admin@tu.com ADMIN_PASSWORD=secret123 pnpm exec tsx scripts/create-admin.ts

# 5. Arrancar
pnpm run start:dev        # desarrollo, con recarga
pnpm run build && pnpm run start:prod   # produccion

# Documentacion interactiva
open http://localhost:3000/docs
```

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm run start:dev` | Desarrollo con recarga automática |
| `pnpm run build` | Compila a `dist/` |
| `pnpm run start:prod` | Ejecuta la versión compilada |
| `pnpm run migration:run` | Aplica migraciones pendientes |
| `pnpm run migration:revert` | Revierte la última migración |
| `pnpm run test` | Tests unitarios |
| `pnpm run test:e2e` | Tests de integración (requiere PostgreSQL) |
| `pnpm run lint` | Lint con oxlint (type-aware) |

---

## Notas conocidas

- **El envío de campañas es secuencial.** `broadcastToAllUsers` manda los correos uno por uno; con
  el SMTP configurado y muchos usuarios va a agotar el tiempo de espera. Está pendiente de pasar a
  un proceso encolado.
- **Gmail limita a ~500 correos por día** con la cuenta configurada.
- **Las e2e usan la base local**, no la del `.env`: `app.module.ts` tiene valores por defecto
  apuntando a `localhost` y los specs no cargan `dotenv`. Hay que aplicar las migraciones también
  ahí antes de correrlas.
- **`adopt-migrations.ts`** existe para registrar la migración inicial como ya aplicada en bases
  creadas con `synchronize=true`. Fue necesario porque Init nunca había corrido sobre una base
  realmente vacía; al apuntar a un servidor en la nube aparecieron dos fallos que estaban ocultos.
