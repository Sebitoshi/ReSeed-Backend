# 📚 Documentación técnica — Reseed Backend

Guía para desarrolladores. Si buscas qué hace la plataforma a nivel de usuario, ve al [README](README.md).

- **Stack:** NestJS 12 · TypeScript · PostgreSQL · TypeORM
- **Package manager:** pnpm
- **Tests:** Vitest
- **Puerto por defecto:** `3000`

---

## 1. Requisitos

| Requisito | Versión |
|---|---|
| Node.js | 20+ |
| pnpm | 9+ |
| PostgreSQL | 14+ |

---

## 2. Instalación

```bash
# 1. Dependencias
pnpm install

# 2. Variables de entorno
cp .env.example .env
# ... edita .env (ver sección 3)

# 3. Esquema de base de datos
pnpm run migration:run

# 4. Arrancar en modo desarrollo (con watch)
pnpm run start:dev

# 5. Crear el primer administrador
ADMIN_EMAIL=admin@correo.com ADMIN_PASSWORD=clave1234 pnpm exec tsx scripts/create-admin.ts
```

La API queda en `http://localhost:3000` y la documentación interactiva en `http://localhost:3000/docs`.

---

## 3. Variables de entorno

Todas tienen valores por defecto para desarrollo local, excepto el SMTP.

| Variable | Por defecto | Descripción |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | Host de PostgreSQL |
| `POSTGRES_PORT` | `5432` | Puerto de PostgreSQL |
| `POSTGRES_USER` | `reseed` | Usuario |
| `POSTGRES_PASSWORD` | `reseed` | Contraseña |
| `POSTGRES_DB` | `reseed` | Base de datos |
| `JWT_SECRET` | `dev-secret` | **Obligatorio en producción.** Secreto para firmar tokens |
| `JWT_EXPIRES_IN` | `7d` | Vigencia del token |
| `PORT` | `3000` | Puerto del servidor |
| `APP_URL` | `http://localhost:3000` | URL pública; se usa en los botones de los correos |
| `RATE_LIMIT_TTL_MS` | `60000` | Ventana del rate limiting (login/register) |
| `RATE_LIMIT_MAX` | `5` | Intentos permitidos por ventana |
| `PAYMENTS_GATEWAY` | `dummy` | Pasarela activa. Solo existe `dummy` (sandbox) |
| `TYPEORM_SYNCHRONIZE` | `false` | **Nunca `true` en producción.** Sincroniza el esquema sin migraciones |

### SMTP (notificaciones por correo)

| Variable | Por defecto | Descripción |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Servidor de correo |
| `SMTP_PORT` | `587` | Puerto |
| `SMTP_SECURE` | `false` | `true` solo si usas puerto 465 con SSL directo |
| `SMTP_USER` | *(vacío)* | Correo de Gmail |
| `SMTP_PASS` | *(vacío)* | Contraseña de aplicación de 16 caracteres |
| `SMTP_FROM_NAME` | `Reseed` | Nombre visible del remitente |
| `SMTP_FROM_EMAIL` | *(igual a `SMTP_USER`)* | Dirección remitente |
| `SMTP_ENABLED` | `true` | `false` corta los envíos sin borrar credenciales |

### Verificación del correo

| Variable | Por defecto | Descripción |
|---|---|---|
| `REQUIRE_EMAIL_VERIFICATION` | `true` | Exige el código de 6 dígitos al registrarse |

**Solo se aplica si el SMTP está habilitado.** Sin correo no hay forma de entregar el código, así que el registro continúa sin verificar en lugar de bloquearse. Pon `false` para saltártela en desarrollo.

> **Si `SMTP_USER` o `SMTP_PASS` están vacíos, nada se rompe.** Las notificaciones se guardan en la base de datos con estado `omitida` y la API responde con normalidad.

### Conseguir credenciales de Gmail

1. Activa la **verificación en dos pasos**: https://myaccount.google.com/signinoptions/two-step-verification
2. Genera una **contraseña de aplicación**: https://myaccount.google.com/apppasswords
3. Pega el código de 16 caracteres en `SMTP_PASS`

> No sirve tu contraseña normal de Google. El código solo se muestra una vez al crearlo.

---

## 4. Comandos

| Comando | Qué hace |
|---|---|
| `pnpm run start:dev` | Desarrollo con recarga automática |
| `pnpm run start` | Arranque simple |
| `pnpm run build` | Compila a `dist/` |
| `pnpm run start:prod` | Ejecuta la versión compilada |
| `pnpm run migration:run` | Aplica migraciones pendientes |
| `pnpm run migration:revert` | Revierte la última migración |
| `pnpm run test` | Tests unitarios |
| `pnpm run test:e2e` | Tests de integración (requiere PostgreSQL) |
| `pnpm run test:cov` | Tests con cobertura |
| `pnpm run lint` | Lint con oxlint (type-aware) |

---

## 5. Arquitectura

### Módulos

| Módulo | Responsabilidad |
|---|---|
| `auth` | Registro, login, emisión de JWT |
| `users` | Perfil, cambio de contraseña, decoradores de acceso |
| `entrepreneurs` | Fichas, directorio público, revisión y auditoría |
| `products` | Catálogo, publicación y categorías |
| `payments` | Checkout, webhooks y reembolsos |
| `notifications` | Historial persistido + envío SMTP |
| `campaigns` | Campañas y su difusión |
| `volunteer` | Actividades e inscripciones |
| `admin` | Panel: usuarios, roles, moderación, difusión y reportes |

Los 9 módulos anteriores están registrados en `app.module.ts`. Aparte, `src/database/` no es un módulo de NestJS sino la configuración de TypeORM: `data-source.ts` (usado por las migraciones) y `migrations/` con el historial del esquema.

### Esquema de módulo

Cada módulo sigue la misma estructura:

```
src/<modulo>/
├── entities/          Entidades TypeORM
├── dto/               DTOs de validación (class-validator)
├── <modulo>.controller.ts
├── <modulo>.service.ts
└── <modulo>.module.ts
```

### Base de datos

**El esquema se gestiona EXCLUSIVAMENTE con migraciones** (`src/database/migrations/`). `synchronize` está deshabilitado y solo debe activarse con `TYPEORM_SYNCHRONIZE=true` en un desarrollo local fresco.

| Migración | Contenido |
|---|---|
| `1760000000000-init` | Users, entrepreneurs, logs de estado |
| `1760000001000-add-softdelete-and-audit` | Soft-delete + tabla de auditoría |
| `1760000002000-products-catalog` | Categorías y productos |
| `1760000003000-payments` | Pagos y reembolsos |
| `1760000004000-users-softban` | `is_active` / `deactivated_at` en usuarios |
| `1760000005000-notifications` | Historial de notificaciones |
| `1760000006000-campaigns` | Campañas |
| `1760000007000-volunteer` | Voluntariados e inscripciones |
| `1760000008000-material-collections` | Materiales recolectados por jornada y su vínculo con la materia prima |
| `1760000009000-entrepreneurs-camelcase` | Corrige las columnas de `entrepreneurs` que Init creaba en snake_case |
| `1760000010000-email-verification` | Verificación del correo por código; marca como verificados a los usuarios existentes |
| `1760000011000-password-reset` | Recuperación de contraseña por código y `password_changed_at` |

Las migraciones son **idempotentes**: verifican con `information_schema` antes de crear cada tabla o columna, así que se pueden ejecutar sobre una base ya existente sin romper nada.

### Borrado lógico

`entrepreneurs`, `products`, `campaigns` y `volunteer_activities` usan `deletedAt` (soft-delete). Nunca se borran registros: se archivan y se pueden restaurar. Cada módulo expone su bandeja de archivados.

---

## 5.1 Materia prima y trazabilidad

La plataforma modela el flujo real del negocio:

```
jornada de limpieza ──► material recolectado ──► producto de materia prima ──► socio ──► artesanía
```

### `material_collections`

Una fila por **cada material registrado en una jornada**. No es un resumen: son registros individuales, para que la traza sea auditable.

| Columna | Tipo | Notas |
|---|---|---|
| `activity_id` | uuid, nullable | Jornada de origen. `ON DELETE SET NULL`: si se borra la jornada, el registro del material **se conserva** por trazabilidad. |
| `material` | enum | `pet`, `plastico_filme`, `plastico_rigido`, `carton`, `papel`, `aluminio`, `vidrio`, `metal`, `organico`, `otro` |
| `quantity` | integer | **Siempre en la unidad base**: gramos si `unit='kg'`, piezas si `unit='unidad'`, bultos si `unit='bulto'`. |
| `unit` | enum | `kg`, `unidad`, `bulto` |
| `collected_at` | timestamptz | Fecha real de la recolección; por defecto el momento del registro. |
| `raw_material_product_id` | uuid, nullable | **El eslabón de la traza.** `ON DELETE SET NULL`. |
| `notes` | text | Observaciones: calidad, humedad, incidencias. |

### Por qué `quantity` es un entero

Misma filosofía que `price_cents`: se almacena en la **unidad mínima** para no arrastrar errores de punto flotante en las sumas.

```
25 kg    → quantity = 25000, unit = 'kg'
320 latas → quantity = 320,   unit = 'unidad'
```

La conversión a texto legible (`"25 kg"`, `"320 piezas"`) se hace en el service con aritmética entera, nunca con división de flotantes.

### El vínculo con la materia prima

`raw_material_product_id` apunta a un `Product`. Ese producto representa la **materia prima procesada** que se vende a los socios. Al establecerlo se cierra la cadena:

| Pregunta | Cómo se responde |
|---|---|
| ¿De qué jornada salió el material de este producto? | `GET /volunteer/admin/collections?rawMaterialProductId=<id>` |
| ¿Qué se recolectó en esa jornada? | `GET /volunteer/public/:id/collections` |
| ¿Qué sigue sin transformar? | `GET /volunteer/admin/collections?rawMaterialProductId=none` |

> Si el producto se borra del catálogo, la recolección **no se borra**: queda como historial y simplemente pierde el vínculo. Nunca se pierde el registro de lo que la comunidad recolectó.

### Convención de categorías

La distinción entre **materia prima** y **artesanías** se maneja con el **árbol de categorías** de `product_categories`, no con un campo propio en `products`. Se crean dos ramas:

```
├── Materia prima          ← lo que compra el socio
│   ├── Fibra reciclada
│   └── Cartón procesado
└── Artesanías             ← lo que vende el socio al público
```

Esto evita duplicar el modelo de productos y permite reutilizar todo lo existente: precios en centavos, stock, publicación y pagos.

### Trazabilidad completa de punta a punta

Con lo anterior se puede reconstruir el origen de cualquier producto:

```
"Hamaca reciclada" (artesanía, publicada)
   └─ fabricada por: Taller Manos del Río (socio, aprobado)
        └─ materia prima: "Fibra de PET triturada" (producto, publicado)
             └─ recolección: 25 kg de PET
                  └─ jornada: "Limpieza de la ribera", 15 nov, 24 voluntarios
```

---

## 6. Autenticación y autorización

### Obtener un token

```bash
POST /auth/login
{ "email": "usuario@correo.com", "password": "clave" }

# Respuesta
{ "accessToken": "eyJhbGci...", "user": { ... } }
```

Úsalo en cada petición autenticada:

```
Authorization: Bearer <accessToken>
```

### Verificación del correo

El registro **no entrega token de inmediato**. Genera un código de 6 dígitos, lo guarda hasheado con bcrypt y lo envía por correo. La cuenta queda inactiva hasta confirmarlo.

```bash
# 1. Registrar
POST /auth/register
{ "email": "ana@correo.com", "password": "clave123", "name": "Ana" }
# -> { "user": { ... }, "requiresVerification": true, "verificationExpiresInMinutes": 15 }

# 2. Confirmar el codigo recibido por correo
POST /auth/verify-email
{ "email": "ana@correo.com", "code": "482913" }
# -> { "user": { ... }, "accessToken": "eyJhbGci..." }

# 3. Pedir otro codigo si no llego
POST /auth/resend-verification
{ "email": "ana@correo.com" }
```

Detalles que importan:

- **El código en claro nunca se persiste.** Solo existe su hash bcrypt; el texto viaja por el correo.
- **Vida útil de 15 minutos**, con 5 intentos por código. Ambos cortan la fuerza bruta.
- **60 segundos de espera entre reenvíos**, para no agotar la cuota diaria de Gmail (~500 correos).
- **`login` responde 403** si el correo no está verificado, y **401** si la contraseña es incorrecta. Que el código de estado los distinga permite redirigir al formulario de verificación sin parsear el mensaje.
- **No revela si un correo está registrado**: `verify-email` y `resend-verification` responden igual aunque la dirección no exista o ya esté confirmada.
- **Los usuarios anteriores a este cambio quedan verificados** por la migración, así que nadie pierde el acceso.

Se salta la verificación cuando el SMTP está deshabilitado o `REQUIRE_EMAIL_VERIFICATION=false`: exigirla sin forma de entregar el código dejaría a todo el mundo sin poder registrarse.

### Recuperación de contraseña

Mismo patrón que la verificación, con dos endpoints públicos:

```bash
POST /auth/forgot-password
{ "email": "ana@correo.com" }
# -> { "reenviado": true, "mensaje": "Si ese correo tiene una cuenta, ..." }

POST /auth/reset-password
{ "email": "ana@correo.com", "code": "482913", "password": "ClaveNueva123" }
# -> { "restablecida": true, "mensaje": "Contrasena actualizada. Inicia sesion con la nueva clave." }
```

Detalles que importan:

- **Cerramos las demás sesiones.** `users.password_changed_at` guarda el momento del cambio y `JwtStrategy` rechaza cualquier token emitido antes. Sin eso, restablecer la contraseña no desalojaría a quien conserve un token perdido o robado. Lo mismo aplica a `POST /users/me/password`.
- **No devuelve token.** Hay que iniciar sesión con la clave nueva: así se confirma que la recuerda.
- **Respuesta neutra** en `forgot-password`, idéntica aunque el correo no tenga cuenta.
- **Estado propio** (`password_reset_*`), separado del de verificación. Si compartieran columnas, pedir un reset invalidaría el código de verificación pendiente de esa misma persona.
- **Mismas políticas**: 15 minutos de vida, 5 intentos, 60 segundos entre solicitudes, código hasheado con bcrypt.
- **Funciona aunque la cuenta no esté verificada.** Alguien que nunca confirmó su correo pero olvidó la clave igual puede recuperarla.

### Los dos guards

**`JwtAuthGuard`** (global, en `app.module.ts`): exige token en **todos** los endpoints. Las rutas públicas lo liberan con `@Public()`.

**`RolesGuard`** (global): aplica los decoradores `@Roles(...)`. Sin metadata deja pasar, así que no afecta a rutas que no declaran roles.

### Validación contra la base de datos

`JwtStrategy` **consulta el usuario en cada request**. No confía en el payload del token. Esto hace que:

- Un **cambio de rol** desde el panel surta efecto **de inmediato**, sin esperar a que venza el token.
- Una **cuenta desactivada** pierda acceso al instante, aunque su token siga siendo válido.

El costo es una consulta SELECT por request autenticada.

### Roles

```ts
enum UserRole {
  ADMIN = 'admin',
  ENTREPRENEUR = 'emprendedor',
  BUYER = 'comprador',
  VOLUNTEER = 'voluntario',
}
```

`admin` **no se puede auto-asignar** en el registro. Se crea con `scripts/create-admin.ts`.

### Protección en capas

La validación de roles ocurre en **dos niveles**: el guard a nivel de rutas y una comprobación dentro del service. No es redundancia — es defensa en profundidad.

---

## 7. API

La documentación interactiva está en **`/docs`** (en español, con `persistAuthorization: true`: pegas el token una vez y se queda).

El documento OpenAPI expone **105 operaciones** en **93 rutas**, agrupadas en 10 tags.

### Autenticación (`/auth`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/auth/register` | Público + rate limit |
| POST | `/auth/verify-email` | Público + rate limit |
| POST | `/auth/resend-verification` | Público + rate limit |
| POST | `/auth/forgot-password` | Público + rate limit |
| POST | `/auth/reset-password` | Público + rate limit |
| POST | `/auth/login` | Público + rate limit |
| GET | `/auth/roles` | Público |
| GET | `/auth/admin/only` | Admin |

### Usuarios (`/users`) — todos requieren token

| Método | Ruta |
|---|---|
| GET | `/users/roles` |
| GET | `/users/me` |
| PATCH | `/users/me` |
| POST | `/users/me/password` |

### Emprendimientos (`/entrepreneurs`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/entrepreneurs/public` | Público |
| GET | `/entrepreneurs/public/:slug` | Público |
| POST | `/entrepreneurs` | Autenticado |
| GET | `/entrepreneurs/mine` | Autenticado |
| GET | `/entrepreneurs/:id` | Dueño o admin |
| GET | `/entrepreneurs/:id/history` | Dueño o admin |
| PATCH | `/entrepreneurs/:id` | Dueño o admin |
| POST | `/entrepreneurs/:id/resubmit` | Dueño o admin |
| GET | `/entrepreneurs/admin/review` | Admin |
| GET | `/entrepreneurs/admin/archived` | Admin |
| POST | `/entrepreneurs/:id/approve` | Admin |
| POST | `/entrepreneurs/:id/reject` | Admin |
| POST | `/entrepreneurs/:id/suspend` | Admin |
| DELETE | `/entrepreneurs/:id` | Admin |
| POST | `/entrepreneurs/:id/restore` | Admin |

### Productos (`/products`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/products/public` | Público |
| GET | `/products/public/:id` | Público |
| POST | `/products` | Dueño de emprendimiento |
| GET | `/products/mine` | Autenticado |
| GET | `/products/:id` | Dueño o admin |
| PATCH | `/products/:id` | Dueño o admin |
| POST | `/products/:id/publish` | Dueño o admin |
| POST | `/products/:id/unpublish` | Dueño o admin |
| DELETE | `/products/:id` | Dueño o admin |

### Categorías (`/product-categories`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/product-categories/public/tree` | Público |
| GET | `/product-categories/public/counts` | Público |
| POST | `/product-categories` | Admin |
| PATCH | `/product-categories/:id` | Admin |
| DELETE | `/product-categories/:id` | Admin (desactiva, no borra) |

### Pagos (`/payments`)

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/payments/checkout` | Autenticado |
| POST | `/payments/webhook/:gateway` | Público (verifica firma HMAC) |
| GET | `/payments/mine` | Autenticado |
| GET | `/payments/:id` | Comprador, vendedor o admin |
| GET | `/payments/:id/refunds` | Comprador, vendedor o admin |
| POST | `/payments/:id/refund` | Comprador, vendedor o admin |
| GET | `/payments/admin/list` | Admin |

### Notificaciones (`/notifications`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/notifications/mine` | Autenticado |
| GET | `/notifications/unread-count` | Autenticado |
| POST | `/notifications/:id/read` | Autenticado |
| GET | `/notifications/admin/list` | Admin |
| GET | `/notifications/admin/stats` | Admin |
| GET | `/notifications/admin/smtp` | Admin |
| POST | `/notifications/admin/test` | Admin |
| POST | `/notifications/admin/:id/resend` | Admin |

### Campañas (`/campaigns`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/campaigns/public` | Público |
| GET | `/campaigns/public/:slug` | Público |
| GET | `/campaigns` | Admin |
| GET | `/campaigns/:id` | Admin |
| GET | `/campaigns/admin/archived` | Admin |
| POST | `/campaigns` | Admin |
| PATCH | `/campaigns/:id` | Admin |
| POST | `/campaigns/:id/publish` | Admin |
| POST | `/campaigns/:id/close` | Admin |
| POST | `/campaigns/:id/notify` | Admin |
| DELETE | `/campaigns/:id` | Admin |
| POST | `/campaigns/:id/restore` | Admin |

### Voluntariados (`/volunteer`)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/volunteer/public` | Público |
| GET | `/volunteer/public/:id` | Público |
| GET | `/volunteer/public/:id/collections` | Público |
| GET | `/volunteer/mine` | Autenticado |
| POST | `/volunteer/:id/signup` | Autenticado |
| DELETE | `/volunteer/:id/signup` | Autenticado |
| GET | `/volunteer` | Admin |
| POST | `/volunteer` | Admin |
| PATCH | `/volunteer/:id` | Admin |
| POST | `/volunteer/:id/open` | Admin |
| POST | `/volunteer/:id/close` | Admin |
| POST | `/volunteer/:id/finish` | Admin |
| DELETE | `/volunteer/:id` | Admin |
| POST | `/volunteer/:id/restore` | Admin |
| GET | `/volunteer/admin/signups` | Admin |
| GET | `/volunteer/admin/archived` | Admin |
| POST | `/volunteer/signups/:id/confirm` | Admin |
| POST | `/volunteer/signups/:id/reject` | Admin |
| GET | `/volunteer/admin/collections` | Admin |
| GET | `/volunteer/admin/collections/summary` | Admin |
| POST | `/volunteer/admin/activities/:id/collections` | Admin |
| PATCH | `/volunteer/admin/collections/:id` | Admin |
| DELETE | `/volunteer/admin/collections/:id/unlink` | Admin |

### Administración (`/admin`) — todo requiere rol admin

| Método | Ruta |
|---|---|
| GET | `/admin/overview` |
| GET | `/admin/users` |
| GET | `/admin/users/:id` |
| PATCH | `/admin/users/:id/role` |
| PATCH | `/admin/users/:id/status` |
| GET | `/admin/moderation/products` |
| POST | `/admin/moderation/products/:id/unpublish` |
| POST | `/admin/moderation/products/:id/restore` |
| POST | `/admin/notifications/broadcast` |
| GET | `/admin/reports/activity` |
| GET | `/admin/reports/users` |
| GET | `/admin/reports/entrepreneurs` |
| GET | `/admin/reports/payments` |
| GET | `/admin/reports/volunteer` |

---

## 8. Notificaciones

### Diseño

Cada notificación **se persiste siempre** en la tabla `notifications` y luego se intenta enviar el correo. Tres estados posibles:

| Estado | Significado |
|---|---|
| `enviada` | El SMTP aceptó el mensaje |
| `fallida` | El envío falló (el motivo queda en `error`) |
| `omitida` | No se intentó: SMTP deshabilitado o sin credenciales |

**El envío nunca interrumpe la operación principal.** Registrar un pago, aprobar una ficha o inscribirse a un voluntariado responde con normalidad aunque el correo falle.

### Tipos

`registro` · `pago` · `reembolso` · `emprendimiento` · `voluntariado` · `campana` · `sistema`

### Eventos que disparan correo

| Evento | Tipo |
|---|---|
| Registro de usuario | `registro` |
| Creación de checkout | `pago` |
| Pago aprobado (webhook) | `pago` |
| Pago rechazado (webhook) | `pago` |
| Reembolso (API o webhook) | `reembolso` |
| Emprendimiento aprobado / rechazado / suspendido | `emprendimiento` |
| Inscripción a voluntariado recibida | `voluntariado` |
| Inscripción confirmada / rechazada | `voluntariado` |
| Difusión de campaña | `campana` |
| Cambio de rol / activación de cuenta | `sistema` |

### Plantillas

Todos los correos se generan con `src/notifications/templates.ts` en español, con un layout HTML común y una versión en texto plano para clientes sin soporte HTML.

---

## 9. Pagos

### Pasarela

Solo existe el adaptador **`dummy`** (sandbox), seleccionable con `PAYMENTS_GATEWAY`. Si configuras otro nombre, la aplicación **falla al arrancar** en lugar de degradarse en silencio.

### Flujo

1. `POST /payments/checkout` crea el pago en estado `pendiente` y devuelve una `checkoutUrl`.
2. El PSP notifica por `POST /payments/webhook/:gateway`.
3. El webhook **valida la firma HMAC** usando `rawBody` (habilitado en `main.ts`).
4. El pago pasa a `aprobado`, `rechazado`, `cancelado` o `reembolsado`.

### Idempotencia

Los webhooks se procesan de forma **idempotente**: si un evento llega dos veces y el pago ya está en el estado destino, se responde sin cambiar nada. Esto evita duplicados cuando el PSP reintenta.

### Reembolsos

Pueden ser totales o parciales. El estado del pago pasa a `reembolsado` solo cuando el monto reembolsado cubre el total.

---

## 10. Validación

`ValidationPipe` global en `main.ts`:

```ts
new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
```

- `whitelist`: elimina propiedades no declaradas en el DTO.
- `forbidNonWhitelisted`: **rechaza con 400** si llega un campo inesperado.
- `transform`: convierte los query params (`?page=2`) a sus tipos declarados.

Los IDs usan `ParseUUIDPipe`: un ID con formato inválido responde `400` en vez de llegar al service.

---

## 11. Convenciones

### Respuestas paginadas

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 12,
  "totalPages": 0
}
```

`limit` está limitado a un máximo de **50** y el tamaño por defecto es **12**.

### Códigos de estado

| Código | Cuándo |
|---|---|
| `200` | Éxito con cuerpo |
| `201` | Recurso creado |
| `204` | Éxito sin cuerpo (borrados lógicos, cambio de contraseña) |
| `400` | Validación fallida o transición inválida |
| `401` | Sin token o token inválido / cuenta desactivada |
| `403` | Autenticado pero sin permisos |
| `404` | Recurso inexistente o sin acceso |
| `409` | Conflicto (duplicado, estado incompatible) |

### Errores

Siempre en español y con esta forma:

```json
{ "message": "Emprendimiento no encontrado", "error": "Not Found", "statusCode": 404 }
```

### Precios

Se almacenan en **centavos** (`priceCents`, `amountCents`) como enteros, para evitar errores de punto flotante. Se exponen junto a su representación decimal (`"12.50"`).

### Slugs

`entrepreneurs` y `campaigns` generan un slug único desde el nombre/título, sin acentos ni caracteres especiales. Si ya existe, se le agrega un sufijo numérico.

---

## 12. Tests

```bash
pnpm run test        # unitarios (mocks, sin base de datos)
pnpm run test:e2e    # integración (requiere PostgreSQL corriendo)
```

**Unitarios** (`*.spec.ts`): construyen los services con `Test.createTestingModule` y mocks de repositorio.

**E2E** (`test/*.e2e-spec.ts`): montan el `AppModule` completo contra PostgreSQL.

> Si agregas una dependencia a un service, recuerda añadir su mock al spec correspondiente o los tests unitarios fallarán con un error de inyección de dependencias de Nest.

---

## 13. Scripts útiles

```bash
# Crear un administrador
ADMIN_EMAIL=admin@correo.com ADMIN_PASSWORD=clave1234 pnpm exec tsx scripts/create-admin.ts

# O pasar los argumentos por CLI
pnpm exec tsx scripts/create-admin.ts admin@correo.com clave1234
```

---

## 14. Despliegue — checklist

- [ ] `JWT_SECRET` con un valor fuerte y distinto de `dev-secret`
- [ ] `TYPEORM_SYNCHRONIZE=false` (o la variable ausente)
- [ ] Credenciales de PostgreSQL correctas y acceso restringido
- [ ] `APP_URL` con la URL pública real (para los enlaces de los correos)
- [ ] SMTP configurado y probado con `POST /notifications/admin/test`
- [ ] Administradores creados por fuera de la API
- [ ] `pnpm run migration:run` ejecutado antes de servir tráfico
- [ ] HTTPS delante del servidor (el webhook depende del `rawBody` sin procesar)
