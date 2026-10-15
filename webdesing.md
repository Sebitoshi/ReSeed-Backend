# Reseed API — guía para el frontend (flujo de usuario)

Referencia detallada de los **endpoints del flujo de un usuario normal** — comprador, voluntario y
socio/emprendedor — más los públicos de cara al visitante. **No incluye nada del panel de
administración** (eso está en `admin-api.md`).

Todo lo de aquí está sacado del código fuente (controladores, DTOs y servicios), así que los
cuerpos, los filtros y las respuestas son los reales. La documentación interactiva con esquemas
vivos está en **`/docs`** (Swagger).

---

## Convenciones generales

| | |
|---|---|
| **URL base (dev)** | `http://localhost:3000` |
| **URL base (prod)** | la de tu despliegue (variable `APP_URL`) |
| **Formato** | JSON (`Content-Type: application/json`) |
| **Auth** | `Authorization: Bearer <accessToken>` en cada petición protegida |
| **Swagger** | `GET /docs` |

### Paginación

Todo listado paginado acepta los mismos query params y devuelve la misma envoltura:

**Entrada** `?page=1&limit=12`
- `page`: número de página, empieza en **1** (por defecto `1`).
- `limit`: resultados por página, **máximo 50** (por defecto `12` en la mayoría).

**Salida**
```json
{
  "items": [ ... ],
  "total": 143,
  "page": 1,
  "limit": 12,
  "totalPages": 12
}
```

### Códigos de estado típicos

| Código | Cuándo |
|---|---|
| `200` | Lectura, edición o acción exitosa |
| `201` | Se creó un recurso (registro, emprendimiento, producto, inscripción, checkout) |
| `204` | Éxito sin cuerpo (cambiar contraseña, eliminar producto) |
| `400` | Validación o regla de negocio |
| `401` | Sin token, token inválido o credenciales incorrectas |
| `403` | Autenticado pero sin permiso, **o correo sin verificar en el login** |
| `404` | No existe (o no es visible para ti) |
| `409` | Conflicto (email ya registrado, contraseña actual incorrecta) |

### Enumeraciones

| Enum | Valores |
|---|---|
| **Rol** (`UserRole`) | `admin`, `emprendedor`, `comprador`, `voluntario` |
| **Estado de ficha** (`EntrepreneurStatus`) | `pendiente`, `aprobado`, `rechazado`, `suspendido` |
| **Estado de producto** (`ProductStatus`) | `borrador`, `publicado`, `despublicado` |
| **Estado de pago** (`PaymentStatus`) | `pendiente`, `aprobado`, `rechazado`, `reembolsado`, `cancelado` |
| **Estado de reembolso** (`RefundStatus`) | `pendiente`, `aprobado`, `rechazado` |
| **Tipo de notificación** (`NotificationType`) | `registro`, `verificacion`, `pago`, `reembolso`, `emprendimiento`, `voluntariado`, `campana`, `sistema` |
| **Estado de notificación** (`NotificationStatus`) | `enviada`, `fallida`, `omitida` |
| **Estado de jornada** (`VolunteerStatus`) | `borrador`, `abierta`, `cerrada`, `finalizada` |
| **Estado de inscripción** (`SignupStatus`) | `pendiente`, `confirmado`, `rechazado`, `cancelado` |
| **Material** (`MaterialType`) | `pet`, `plastico_filme`, `plastico_rigido`, `carton`, `papel`, `aluminio`, `vidrio`, `metal`, `organico`, `otro` |
| **Unidad de recolección** (`CollectionUnit`) | `kg`, `unidad`, `bulto` |
| **Estado de campaña** (`CampaignStatus`) | `borrador`, `activa`, `finalizada` |

---

## Flujos principales

```
REGISTRO              COMPRA                    SER SOCIO                  VOLUNTARIO
────────              ──────                    ─────────                  ──────────
register              /products/public          POST /entrepreneurs        /volunteer/public
   │ (sin token)          │                          │ (queda pendiente)        │
verify-email          checkout                  (admin aprueba)            POST /:id/signup
   │ ⇄ 403 en login       │                          │                          │
login                 redirige a la pasarela    POST /products             estado "pendiente"
   │                      │                          │                          │
accessToken           webhook confirma          publish                    (admin confirma)
                      → /payments/mine          aparece en catálogo        correo de confirmación
```

---

# 1. Autenticación — `/auth`

### `POST /auth/register` · Público

Crea la cuenta. El rol `admin` **no** se puede pedir aquí.

**Body**
| Campo | Tipo | Reglas |
|---|---|---|
| `email` | string | email válido, único |
| `password` | string | mínimo **8**, máximo 72 |
| `name` | string | 1–120 |
| `role` | enum | `emprendedor`, `comprador` o `voluntario` (por defecto `comprador`) |

```json
{ "email": "ana@correo.com", "password": "Secreto123", "name": "Ana Pérez", "role": "voluntario" }
```

**Respuesta `201` — con verificación por correo activa**
```json
{
  "user": {
    "id": "b3c1...", "email": "ana@correo.com", "name": "Ana Pérez",
    "role": "voluntario", "bio": null, "phone": null,
    "isActive": true, "emailVerifiedAt": null, "createdAt": "2026-10-14T10:00:00.000Z"
  },
  "requiresVerification": true,
  "verificationExpiresInMinutes": 15
}
```

**Respuesta `201` — si la verificación está desactivada** (SMTP apagado o
`REQUIRE_EMAIL_VERIFICATION=false`): en vez de `requiresVerification` llega `accessToken` y ya
puedes entrar.

> Errores: `409` si el email ya está registrado. Si no hay SMTP configurado, la verificación se
> omite a propósito (si no, nadie podría registrarse).

### `POST /auth/verify-email` · Público

Confirma el código de 6 dígitos. **Al acertar devuelve el token.**

**Body**: `{ "email": "ana@correo.com", "code": "482913" }`
- `code`: exactamente **6 dígitos**.

**Respuesta `200`**
```json
{
  "user": { "id": "b3c1...", "email": "ana@correo.com", "role": "voluntario", "emailVerifiedAt": "2026-10-14T10:02:00.000Z", "..." : "..." },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```
Errores `401`: código incorrecto, expirado (15 min) o más de 5 intentos.

### `POST /auth/resend-verification` · Público

Reenvía el código (espera **60 s** entre envíos).
**Body**: `{ "email": "ana@correo.com" }`

**Respuesta `200`** (neutra: no revela si el correo existe)
```json
{ "reenviado": true, "mensaje": "Si ese correo esta pendiente de verificar, recibiras un codigo en unos minutos.", "verificationExpiresInMinutes": 15 }
```

### `POST /auth/forgot-password` · Público

**Body**: `{ "email": "ana@correo.com" }`

**Respuesta `200`** (neutra)
```json
{ "reenviado": true, "mensaje": "Si ese correo tiene una cuenta, recibiras un codigo para elegir una contrasena nueva." }
```

### `POST /auth/reset-password` · Público

**Body**
| Campo | Reglas |
|---|---|
| `email` | email |
| `code` | 6 dígitos |
| `password` | mínimo 8, máximo 72 |

**Respuesta `200`**
```json
{ "restablecida": true, "mensaje": "Contrasena actualizada. Inicia sesion con la nueva clave." }
```

> Al cambiar la contraseña **se cierran las demás sesiones**: los tokens anteriores dejan de servir.
> Errores `401`: código incorrecto, expirado o más de 5 intentos.

### `POST /auth/login` · Público (límite: 5 intentos/min)

**Body**: `{ "email": "ana@correo.com", "password": "Secreto123" }`

**Respuesta `200`**
```json
{
  "user": { "id": "b3c1...", "email": "ana@correo.com", "name": "Ana Pérez", "role": "voluntario", "bio": null, "phone": null, "isActive": true, "emailVerifiedAt": "2026-10-14T10:02:00.000Z", "createdAt": "..." },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

> **Clave para el frontend:** el login distingue dos errores.
> - **`401`** → credenciales incorrectas (o cuenta desactivada). Muestra el error en el formulario.
> - **`403`** → la contraseña era correcta pero **el correo no está verificado**. Redirige a la
>   pantalla de verificación. No hace falta parsear el texto del error.

### `GET /auth/roles` · Público

**Respuesta `200`**: `{ "roles": ["admin", "emprendedor", "comprador", "voluntario"] }`

---

# 2. Mi cuenta — `/users` (requiere token)

### `GET /users/me`

Devuelve tu perfil (sin contraseña).

**Respuesta `200`** — objeto `PublicUser`:
```json
{
  "id": "b3c1...", "email": "ana@correo.com", "name": "Ana Pérez",
  "role": "voluntario", "bio": null, "phone": null,
  "isActive": true, "emailVerifiedAt": "2026-10-14T10:02:00.000Z",
  "createdAt": "2026-10-14T10:00:00.000Z"
}
```

### `PATCH /users/me`

**Body** (todos opcionales)
| Campo | Reglas |
|---|---|
| `name` | 1–120 |
| `bio` | máx 2000 |
| `phone` | máx 60 |

**Respuesta `200`**: el `PublicUser` actualizado.

### `POST /users/me/password`

**Body**: `{ "currentPassword": "Secreto123", "newPassword": "NuevaClave123" }`
- `newPassword`: mínimo 8, máximo 72.

**Respuesta `204`** sin cuerpo.
> Error `409` si `currentPassword` no coincide. También cierra las demás sesiones.

### `GET /users/roles` (autenticado)

Igual que `/auth/roles`: `{ "roles": [...] }`.

---

# 3. Catálogo público — `/products`

Sin token. Solo aparecen productos **publicados y activos** cuyo emprendimiento esté **aprobado**.

### `GET /products/public`

**Query params**
| Param | Tipo | Descripción |
|---|---|---|
| `page` | int | página (1) |
| `limit` | int | por página (máx 50, def. 12) |
| `categoryId` | uuid | filtra por categoría |
| `entrepreneurId` | uuid | filtra por emprendimiento |
| `q` | string | busca en nombre o descripción (sin distinguir mayúsculas) |

**Respuesta `200`** — `Paginated<PublicProduct>`:
```json
{
  "items": [
    {
      "id": "7f2a...", "name": "Miel de Ulmo",
      "description": "Miel monofloral de ulmo cosechada en bosques nativos.",
      "priceCents": 8900, "price": "89.00",
      "stock": 10, "available": 10,
      "isActive": true,
      "images": ["https://cdn.ejemplo.com/ulmo-1.jpg", "https://cdn.ejemplo.com/ulmo-2.jpg"],
      "categoryId": "c1a2...",
      "createdAt": "2026-10-10T09:00:00.000Z"
    }
  ],
  "total": 143, "page": 1, "limit": 12, "totalPages": 12
}
```

> **Ojo con `price`**: usa siempre `price` (string decimal, p. ej. `"89.00"`) para mostrar el precio;
> `priceCents` es el entero en centavos. **Nunca** hagas la división con flotantes en el frontend.
> `stock: null` significa ilimitado (servicio). `available` es el stock disponible.

> **El objeto público NO incluye el nombre del emprendimiento ni su id.** El catálogo permite
> filtrar por `entrepreneurId`, pero para mostrar "vendido por X" en la tarjeta, resuelve el nombre
> cruzando el `categoryId` con `/product-categories/public/tree` y, si conoces el emprendimiento,
> con `/entrepreneurs/public/:slug`.

### `GET /products/public/:id`

- `:id` debe ser **UUID** (si no, `400`).

**Respuesta `200`**: un `PublicProduct` (igual que los ítems de arriba).
**`404`** si no existe, no está publicado o su emprendimiento no está aprobado.

---

# 4. Categorías — `/product-categories`

### `GET /product-categories/public/tree`

Árbol de hasta 2 niveles (categoría → subcategoría), solo activas.

**Respuesta `200`**
```json
[
  {
    "id": "c1a2...", "name": "Miel y Derivados", "slug": "miel-y-derivados",
    "children": [
      { "id": "c1a3...", "name": "Miel monofloral", "slug": "miel-monofloral", "children": [] }
    ]
  }
]
```

### `GET /product-categories/public/counts`

Productos publicados por categoría — ideal para los filtros del catálogo.

**Respuesta `200`**
```json
[ { "categoryId": "c1a2...", "name": "Miel y Derivados", "products": 12 } ]
```

---

# 5. Emprendimientos públicos — `/entrepreneurs/public`

### `GET /entrepreneurs/public`

Directorio de socios **aprobados** y no archivados.

**Query params**: `page`, `limit`, `categoria` (exacta, sin distinguir mayúsculas), `q` (nombre o descripción).

**Respuesta `200`** — `Paginated<PublicEntrepreneur>`:
```json
{
  "items": [
    {
      "id": "e9b1...", "name": "Miel Dorada", "slug": "miel-dorada",
      "description": "Miel pura de apicultores locales de la sierra.",
      "category": "Alimentos", "logoUrl": "https://cdn.ejemplo.com/logo.png",
      "contactPhone": "+56912345678", "contactEmail": "contacto@mieldorada.cl",
      "status": "aprobado", "createdAt": "2026-09-01T12:00:00.000Z"
    }
  ],
  "total": 8, "page": 1, "limit": 12, "totalPages": 1
}
```

### `GET /entrepreneurs/public/:slug`

**Respuesta `200`**: un `PublicEntrepreneur`.
**`404`** si no existe o no está aprobado. Para mostrar sus productos usa
`GET /products/public?entrepreneurId=<id>` — aunque recuerda que el producto público no trae el
`entrepreneurId`, así que lo natural es que el perfil traiga esa lista ya resuelta o que el
`PublicProduct` se amplíe.

---

# 6. Campañas públicas — `/campaigns/public`

### `GET /campaigns/public`

Solo campañas en estado `activa`. **Query params**: `page`, `limit`.

**Respuesta `200`** — `Paginated<CampaignView>`:
```json
{
  "items": [
    {
      "id": "ca71...", "title": "Semana de la Miel Solidaria", "slug": "semana-de-la-miel-solidaria",
      "summary": "Cada compra apoya a los apicultores de la sierra.",
      "description": "Descripción completa de la campaña...",
      "imageUrl": "https://cdn.ejemplo.com/campana.jpg",
      "goalCents": 5000000, "donationUrl": "https://donar.ejemplo.com/miel",
      "status": "activa",
      "startsAt": "2026-10-01T00:00:00.000Z", "endsAt": "2026-10-31T00:00:00.000Z",
      "isActive": true,
      "createdAt": "2026-09-20T10:00:00.000Z", "updatedAt": "2026-09-25T10:00:00.000Z"
    }
  ],
  "total": 3, "page": 1, "limit": 12, "totalPages": 1
}
```
> `isActive` indica si la campaña está dentro de sus fechas ahora mismo. `goalCents` es la meta en
> centavos (o `null` si es informativa). Usa `goalCents / 100` solo para mostrar; para sumar usa
> enteros.

### `GET /campaigns/public/:slug`

**Respuesta `200`**: un `CampaignView`. **`404`** si no existe o no está activa.

---

# 7. Jornadas de limpieza — `/volunteer/public`

### `GET /volunteer/public`

Jornadas **abiertas** (con inscripción activa) ordenadas por fecha ascendente.

**Query params**: `page`, `limit`.

**Respuesta `200`** — `Paginated<VolunteerView>`:
```json
{
  "items": [
    {
      "id": "v01a...", "title": "Jornada de limpieza del humedal",
      "description": "Recolección de PET, latas y vidrio. Llevar guantes.",
      "location": "Parque La Esperanza, Bogotá",
      "startsAt": "2026-10-20T13:00:00.000Z", "endsAt": "2026-10-20T17:00:00.000Z",
      "slots": 20, "imageUrl": "https://cdn.ejemplo.com/jornada.jpg",
      "status": "abierta",
      "taken": 7, "remaining": 13,
      "createdAt": "2026-10-01T09:00:00.000Z"
    }
  ],
  "total": 4, "page": 1, "limit": 12, "totalPages": 1
}
```
> `taken` = inscripciones que ocupan cupo (pendientes + confirmadas). `remaining` = cupos libres
> (`null` si `slots` es `null`, es decir ilimitado). Con `remaining: 0`, deshabilita el botón de
> inscripción.

### `GET /volunteer/public/:id`

- `:id` es **UUID**.

**Respuesta `200`**: un `VolunteerView`. **`404`** si no existe o aún está en borrador.

### `GET /volunteer/public/:id/collections`

Lo que la jornada recolectó y en qué materia prima terminó — la traza de impacto.

**Respuesta `200`**: `CollectionView[]`
```json
[
  {
    "id": "col1...", "activityId": "v01a...", "activityTitle": "Jornada de limpieza del humedal",
    "material": "pet", "quantity": 25000, "unit": "kg",
    "quantityLabel": "25 kg",
    "collectedAt": "2026-10-20T16:00:00.000Z",
    "rawMaterialProductId": "7f2a...", "rawMaterialProductName": "PET molido",
    "notes": "Buena calidad, poco húmedo.",
    "createdBy": "u123...", "createdAt": "2026-10-20T16:05:00.000Z"
  }
]
```
> Muestra siempre `quantityLabel` (`"25 kg"`, `"320 piezas"`, `"12 bultos"`) o el par
> `quantity` + `unit`. `rawMaterialProductName: null` significa "aún sin transformar".

---

# 8. Ser socio — `/entrepreneurs` (requiere token)

Enviar una ficha no te hace socio todavía: queda **`pendiente`** hasta que un admin la apruebe.

### `POST /entrepreneurs`

**Body**
| Campo | Tipo | Reglas |
|---|---|---|
| `name` | string | 2–150 |
| `description` | string | **mínimo 20**, máx 2000 |
| `category` | string | opcional, máx 100 |
| `logoUrl` | string | opcional, URL, máx 255 |
| `contactPhone` | string | opcional, máx 100 |
| `contactEmail` | string | opcional, email, máx 255 |

**Respuesta `201`** — objeto `OwnerEntrepreneur` (= `PublicEntrepreneur` + `ownerId`,
`reviewNote`, `updatedAt`), con `status: "pendiente"`:
```json
{
  "id": "e9b1...", "name": "Miel Dorada", "slug": "miel-dorada",
  "description": "Miel pura de apicultores locales.", "category": "Alimentos",
  "logoUrl": null, "contactPhone": null, "contactEmail": null,
  "status": "pendiente", "createdAt": "2026-10-14T10:00:00.000Z",
  "ownerId": "b3c1...", "reviewNote": null, "updatedAt": "2026-10-14T10:00:00.000Z"
}
```

### `GET /entrepreneurs/mine`

**Query params**: `page`, `limit`.

**Respuesta `200`**: `Paginated<OwnerEntrepreneur>` con tus fichas y su estado.

### `GET /entrepreneurs/:id`

Vista del dueño (o admin): incluye `reviewNote` y estado.

**Respuesta `200`**: un `OwnerEntrepreneur`. **`403`** si la ficha no es tuya.

### `PATCH /entrepreneurs/:id`

**Body**: los mismos campos que al crear, todos opcionales.
> Si cambias `name`, se regenera el `slug` (y puede añadirse un sufijo si ya existe).

**Respuesta `200`**: el `OwnerEntrepreneur` actualizado.

### `GET /entrepreneurs/:id/history`

Línea de tiempo de estados.

**Respuesta `200`**
```json
[
  {
    "id": "log1...", "entrepreneurId": "e9b1...",
    "toStatus": "pendiente", "actorId": "b3c1...", "actorRole": "emprendedor",
    "note": null, "createdAt": "2026-10-14T10:00:00.000Z"
  }
]
```

### `POST /entrepreneurs/:id/resubmit`

Vuelve a `pendiente` una ficha **rechazada** o **suspendida**.
**Respuesta `200`**: `OwnerEntrepreneur`. **`400`** si el estado no permite reenviar.

> El dueño **no puede archivar** su ficha; eso es solo del admin (`DELETE /entrepreneurs/:id`), y
> por eso no figura en esta guía.

---

# 9. Mi taller — `/products` (requiere token)

### `POST /products`

El producto **nace en `borrador`** y solo lo ves tú hasta publicarlo.

**Body**
| Campo | Tipo | Reglas |
|---|---|---|
| `name` | string | 2–180 |
| `description` | string | mínimo **10**, máx 4000 |
| `priceCents` | int | entero ≥ 1, máx 2 000 000 000 |
| `stock` | int | opcional, ≥ 0 (`null`/omitido = ilimitado) |
| `categoryId` | uuid | obligatorio |
| `entrepreneurId` | uuid | opcional; **obligatorio si tienes más de un emprendimiento** |
| `images` | string[] | opcional, hasta 8 URLs (la primera es la principal) |
| `isActive` | bool | opcional, por defecto `true` |

```json
{
  "name": "Miel de Ulmo",
  "description": "Miel monofloral de ulmo cosechada en bosques nativos.",
  "priceCents": 8900,
  "stock": 10,
  "categoryId": "c1a2...",
  "images": ["https://cdn.ejemplo.com/ulmo-1.jpg"]
}
```

**Respuesta `201`** — `OwnerProduct` (`PublicProduct` + `entrepreneurId`, `status`, `updatedAt`):
```json
{
  "id": "7f2a...", "name": "Miel de Ulmo", "description": "...",
  "priceCents": 8900, "price": "89.00", "stock": 10, "available": 10,
  "isActive": true, "images": ["https://cdn.ejemplo.com/ulmo-1.jpg"],
  "categoryId": "c1a2...", "createdAt": "...",
  "entrepreneurId": "e9b1...", "status": "borrador", "updatedAt": "..."
}
```

> Errores: `400` "Primero crea tu emprendimiento" (si no tienes ninguno) o "Tienes varios
> emprendimientos: indica entrepreneurId"; `404` si la categoría no existe.

### `GET /products/mine`

Tus productos **en cualquier estado**. **Query params**: `page`, `limit`, `categoryId`, `q`.
**Respuesta `200`**: `Paginated<OwnerProduct>`.

### `GET /products/:id`

**Respuesta `200`**: `OwnerProduct`. **`404`** si no es tuyo (ni eres admin).

### `PATCH /products/:id`

**Body**: igual que crear, todo opcional (`name`, `description`, `priceCents`, `stock`,
`categoryId`, `images`, `isActive`). `images` **reemplaza** el set completo.
> Regla editorial: editar un producto **publicado lo devuelve a `borrador`** (hay que republicar).

**Respuesta `200`**: `OwnerProduct`.

### `POST /products/:id/publish`

**Respuesta `200`**: `OwnerProduct` con `status: "publicado"`.
> Errores `400`: el emprendimiento debe estar **aprobado** y el producto "completo" (nombre ≥ 2 y
> descripción ≥ 10).

### `POST /products/:id/unpublish`

Sale del catálogo sin borrarse. **Respuesta `200`**: `OwnerProduct` con `status: "despublicado"`.

### `DELETE /products/:id`

Borrado lógico (**soft-delete**). **Respuesta `204`** sin cuerpo.

---

# 10. Pagos — `/payments` (requiere token)

### `POST /payments/checkout`

Crea la intención de pago y devuelve la URL del checkout alojado de la pasarela.

**Body**
| Campo | Tipo | Reglas |
|---|---|---|
| `amountCents` | int | entero ≥ 1 (en centavos) |
| `currencyCode` | string | opcional, por defecto `COP` |
| `description` | string | opcional (se muestra en el checkout) |
| `entrepreneurId` | uuid | opcional (emprendimiento que cobra) |
| `metadata` | object<string,string> | opcional (se devuelve en el webhook) |

```json
{ "amountCents": 2590000, "description": "Jabón artesanal x3", "entrepreneurId": "e9b1..." }
```

**Respuesta `201`**
```json
{
  "payment": {
    "id": "p01...", "externalRef": "0b6f...", "amountCents": 2590000, "amount": "25900.00",
    "currencyCode": "COP", "status": "pendiente", "refundedAmountCents": 0,
    "description": "Jabón artesanal x3", "confirmedAt": null,
    "createdAt": "2026-10-14T10:00:00.000Z",
    "payerUserId": "b3c1...", "entrepreneurId": "e9b1..."
  },
  "checkoutUrl": "https://pasarela.ejemplo.com/checkout/abc123"
}
```

> El frontend debe **redirigir a `checkoutUrl`**. El estado del pago (`aprobado`, `rechazado`…)
> **no cambia hasta que la pasarela llama al webhook**, que es un endpoint del servidor
> (`POST /payments/webhook/:gateway`) y **no lo llama el frontend**. Para reflejar el resultado,
> haz *polling* sobre `GET /payments/:id` o `GET /payments/mine` cuando vuelvas de la pasarela, o
> revisa las notificaciones.

### `GET /payments/mine`

**Query params**: `page`, `limit`, `status` (enum). **Respuesta `200`**: `Paginated<OwnerPayment>`.

### `GET /payments/:id`

**Respuesta `200`**: `OwnerPayment`. **`403`** si no eres comprador, vendedor ni admin.

### `POST /payments/:id/refund`

Solicita un reembolso total o parcial.

**Body**
| Campo | Tipo | Reglas |
|---|---|---|
| `amountCents` | int | opcional, ≥ 1; si se omite, **todo** lo pendiente |
| `reason` | string | opcional (queda en la auditoría) |

**Respuesta `200`**: `OwnerPayment` actualizado (con `refundedAmountCents` y `status`).
> Errores `400`: solo se reembolsa un pago **aprobado** y hasta lo pendiente. `403` si no eres
> comprador/vendedor/admin del pago.

### `GET /payments/:id/refunds`

**Respuesta `200`**
```json
[
  {
    "id": "r01...", "paymentId": "p01...", "amountCents": 1000000,
    "status": "aprobado", "externalRef": "rf-123",
    "actorUserId": "b3c1...", "reason": "Producto dañado en envío",
    "createdAt": "2026-10-14T11:00:00.000Z"
  }
]
```

---

# 11. Notificaciones — `/notifications` (requiere token)

Es el registro de correos que recibiste, con su estado.

### `GET /notifications/mine`

**Query params**: `page`, `limit`, `type` (enum `NotificationType`), `unread` (bool — solo no leídas).

**Respuesta `200`** — `Paginated<Notification>`:
```json
{
  "items": [
    {
      "id": "n01...", "userId": "b3c1...", "email": "ana@correo.com",
      "type": "pago", "status": "enviada",
      "subject": "Pago confirmado", "body": "<html>...</html>",
      "referenceType": "payment", "referenceId": "p01...",
      "sentAt": "2026-10-14T10:05:00.000Z", "readAt": null,
      "error": null, "attempts": 1, "createdAt": "2026-10-14T10:05:00.000Z"
    }
  ],
  "total": 5, "page": 1, "limit": 12, "totalPages": 1
}
```
> `status` puede ser `enviada`, `fallida` u `omitida` (SMTP deshabilitado o sin credenciales). Un
> correo fallido **no rompe** el flujo que lo originó. Programa el aviso por si el SMTP está caído.

### `GET /notifications/unread-count`

Para el badge del header. **Respuesta `200`**: `{ "unread": 3 }`.

### `POST /notifications/:id/read`

Marca como leída. **Respuesta `200`**: la `Notification` con `readAt` establecido.
**`404`** si la notificación no es tuya.

---

# 12. Voluntariado — `/volunteer` (requiere token)

### `POST /volunteer/:id/signup`

Te inscribes a una jornada abierta. La inscripción queda **`pendiente`** hasta que un
administrador la confirme.

**Respuesta `201`** — `SignupView`:
```json
{
  "id": "s01...", "activityId": "v01a...", "activityTitle": "Jornada de limpieza del humedal",
  "userId": "b3c1...", "status": "pendiente", "note": null,
  "confirmedAt": null, "createdAt": "2026-10-14T10:00:00.000Z"
}
```
> Errores: `400` si la jornada no está abierta o no quedan cupos; `409` si ya estabas inscrito.

### `DELETE /volunteer/:id/signup`

Cancela tu inscripción (libera el cupo).
**Respuesta `200`**: `SignupView` con `status: "cancelado"`.
> `400` si ya estabas **confirmado** (ahí hay que hablar con el organizador).

### `GET /volunteer/mine`

Tus inscripciones. **Query params**: `page`, `limit`.
**Respuesta `200`**: `Paginated<SignupView>`.

---

# Anexos

## Resumen de rutas del flujo de usuario

| Método | Ruta | Auth | Para qué |
|---|---|---|---|
| POST | `/auth/register` | Público | Crear cuenta |
| POST | `/auth/verify-email` | Público | Confirmar código → token |
| POST | `/auth/resend-verification` | Público | Reenviar código |
| POST | `/auth/forgot-password` | Público | Pedir código de recuperación |
| POST | `/auth/reset-password` | Público | Cambiar clave con código |
| POST | `/auth/login` | Público | Iniciar sesión (401 vs 403) |
| GET | `/auth/roles` | Público | Listar roles |
| GET | `/users/me` | Token | Mi perfil |
| PATCH | `/users/me` | Token | Editar mi perfil |
| POST | `/users/me/password` | Token | Cambiar contraseña |
| GET | `/users/roles` | Token | Listar roles |
| GET | `/products/public` | Público | Catálogo |
| GET | `/products/public/:id` | Público | Detalle de producto |
| GET | `/product-categories/public/tree` | Público | Árbol de categorías |
| GET | `/product-categories/public/counts` | Público | Conteo por categoría |
| GET | `/entrepreneurs/public` | Público | Directorio de socios |
| GET | `/entrepreneurs/public/:slug` | Público | Perfil público de socio |
| GET | `/campaigns/public` | Público | Campañas activas |
| GET | `/campaigns/public/:slug` | Público | Detalle de campaña |
| GET | `/volunteer/public` | Público | Jornadas abiertas |
| GET | `/volunteer/public/:id` | Público | Detalle de jornada |
| GET | `/volunteer/public/:id/collections` | Público | Material recolectado |
| POST | `/entrepreneurs` | Token | Solicitar ficha de socio |
| GET | `/entrepreneurs/mine` | Token | Mis fichas |
| GET | `/entrepreneurs/:id` | Token | Ver mi ficha |
| PATCH | `/entrepreneurs/:id` | Token | Editar mi ficha |
| GET | `/entrepreneurs/:id/history` | Token | Historial de mi ficha |
| POST | `/entrepreneurs/:id/resubmit` | Token | Reenviar ficha a revisión |
| POST | `/products` | Token | Crear producto |
| GET | `/products/mine` | Token | Mis productos |
| GET | `/products/:id` | Token | Ver mi producto |
| PATCH | `/products/:id` | Token | Editar producto |
| POST | `/products/:id/publish` | Token | Publicar |
| POST | `/products/:id/unpublish` | Token | Despublicar |
| DELETE | `/products/:id` | Token | Eliminar (soft) |
| POST | `/payments/checkout` | Token | Iniciar pago |
| GET | `/payments/mine` | Token | Mis pagos |
| GET | `/payments/:id` | Token | Ver un pago |
| POST | `/payments/:id/refund` | Token | Reembolso |
| GET | `/payments/:id/refunds` | Token | Reembolsos del pago |
| GET | `/notifications/mine` | Token | Mis notificaciones |
| GET | `/notifications/unread-count` | Token | No leídas |
| POST | `/notifications/:id/read` | Token | Marcar leída |
| POST | `/volunteer/:id/signup` | Token | Inscribirme a una jornada |
| DELETE | `/volunteer/:id/signup` | Token | Cancelar inscripción |
| GET | `/volunteer/mine` | Token | Mis inscripciones |

## Notas para el frontend

1. **Todo token va en `Authorization: Bearer`.** Tras un cambio de contraseña, los tokens viejos
   dejan de servir: si recibes `401`, manda al login.
2. **Precios**: usa el string `price` / `amount` para mostrar; guarda y suma en centavos.
3. **Cantidades**: usa `quantityLabel`; el entero viene en la unidad base (gramos si es `kg`).
4. **Estados**: ficha y producto nacen en `borrador`/`pendiente`. Hay que esperar la aprobación del
   admin antes de que algo sea público.
5. **Correo**: el SMTP es *best-effort*. Una notificación `fallida`/`omitida` no significa que la
   acción falló.
6. **Login `403` vs `401`**: `403` → ve a verificar el correo; `401` → error de credenciales.
7. **Catálogo y emprendimiento**: el producto público trae `categoryId` pero no el nombre del
   emprendimiento; si necesitas mostrarlo, cruza con el directorio o amplía el payload.
8. **Webhook**: el estado del pago cambia por el webhook de la pasarela, no por el frontend. Vuelve
   de la pasarela y refresca con `/payments/:id`.
