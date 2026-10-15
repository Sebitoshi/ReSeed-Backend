# Reseed Web — mapa de vistas (weblist)

Este documento lista **todas las vistas (pantallas) que necesita la aplicación web** de Reseed,
derivadas una a una de los **105 endpoints** del backend y del modelo de negocio:

```
JORNADA DE LIMPIEZA → RECICLABLES → MATERIA PRIMA → SOCIO (artesano) → PRODUCTO → VENTA
```

Cada vista indica su **ruta sugerida**, **qué muestra o para qué sirve** y **qué endpoints la
alimentan**, de modo que el frontend se puede construir sin adivinar: todo lo que una pantalla
necesita ya existe en la API.

> Para la referencia completa de la API (requests y respuestas) ver `contexto.md` y
> `admin-api.md`. La documentación interactiva vive en `/docs` (Swagger).

---

## Mapa general

La aplicación es en realidad **cuatro "apps" en una**, según quién esté mirando:

```
                        ┌────────────────────────────────────────────┐
                        │  1. VISTAS PÚBLICAS  (sin sesión)          │
                        │  Inicio · Catálogo · Socios · Campañas     │
                        │  Jornadas de limpieza                       │
                        └────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
        ┌────────────────────────┐                 ┌────────────────────────┐
        │  2. MI CUENTA (sesión) │                 │  3. PANEL DEL SOCIO    │
        │  Perfil · Pagos ·      │                 │  Ficha · Taller ·      │
        │  Notificaciones ·      │                 │  Productos · Ventas    │
        │  Mis jornadas          │                 │                        │
        └────────────────────────┘                 └────────────────────────┘
                    │                                           │
                    └───────────────────┬───────────────────────┘
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │  4. PANEL DE ADMINISTRACIÓN               │
                        │  Dashboard · Reportes · Usuarios ·        │
                        │  Moderación · Jornadas · Campañas ·       │
                        │  Pagos · Categorías · Correos             │
                        └────────────────────────────────────────────┘
```

Las vistas de autenticación (login, registro, verificación, recuperación) son **transversales**:
las usan los cuatro grupos.

---

## Convenciones de este documento

- **Acceso** indica quién puede entrar a la vista, según el rol del token:
  `Público` (sin sesión), `Cuenta` (cualquier usuario autenticado), `Socio` (rol
  entrepreneur/socio), `Admin`.
- **Endpoints** son las llamadas que la vista necesita; varias requieren
  `Authorization: Bearer <accessToken>`.
- El registro **no permite elegir rol admin**: el primer administrador se crea con
  `scripts/create-admin.ts` y el resto de roles se otorgan desde el panel.
- Toda ficha de socio y todo producto **nace en `borrador`** y solo se publica tras aprobación de
  un admin: por eso hay vistas de "estado de revisión" para el socio y de "moderación" para el
  admin.
- El login responde **403** cuando el correo no está verificado (→ redirigir a la vista de
  verificación) y **401** cuando la contraseña es incorrecta (→ mostrar error en el formulario).
  No hace falta adivinar: es el código de estado quien decide a dónde se navega.

---

# 1. Vistas públicas (visitante sin sesión)

| # | Vista | Ruta sugerida | Qué muestra / hace | Endpoints |
|---|-------|---------------|--------------------|-----------|
| 1 | **Inicio / Landing** | `/` | Presenta el ciclo completo (jornadas → reciclables → materia prima → artesanías), campañas activas destacadas, próximas jornadas abiertas, socios destacados y los botones que llevan al catálogo | `GET /campaigns/public`, `GET /volunteer/public`, `GET /products/public`, `GET /entrepreneurs/public` |
| 2 | **Catálogo de productos** | `/catalogo` | Productos publicados con paginación, filtros y conteo por categoría; navega a categorías desde el árbol | `GET /products/public`, `GET /product-categories/public/tree`, `GET /product-categories/public/counts` |
| 3 | **Detalle de producto** | `/productos/:id` | Fotos, descripción, categoría, socio que lo fabrica, cantidad/medida y botón de compra | `GET /products/public/:id` |
| 4 | **Directorio de emprendimientos** | `/socios` | Lista de fichas de socios publicadas (perfiles de artesanos) | `GET /entrepreneurs/public` |
| 5 | **Perfil público de socio** | `/socios/:slug` | Historia del artesano, estado, y sus productos publicados | `GET /entrepreneurs/public/:slug`, `GET /products/public` (filtrado por socio) |
| 6 | **Campañas públicas** | `/campanas` | Campañas solidarias publicadas | `GET /campaigns/public` |
| 7 | **Detalle de campaña** | `/campanas/:slug` | Objetivo, avance, fechas y llamada a participar | `GET /campaigns/public/:slug` |
| 8 | **Jornadas de limpieza** | `/voluntariado` | Jornadas abiertas con inscripción activa, fecha y lugar | `GET /volunteer/public` |
| 9 | **Detalle de jornada** | `/voluntariado/:id` | Fecha, lugar, qué se recolecta, **lo ya recolectado** (traza) y botón "Inscribirme" (pide sesión) | `GET /volunteer/public/:id`, `GET /volunteer/public/:id/collections` |

---

# 2. Vistas de cuenta (cualquier usuario con sesión)

Sirven a los tres perfiles con sesión: **comprador**, **voluntario** y **socio**.

| # | Vista | Ruta sugerida | Qué muestra / hace | Endpoints |
|---|-------|---------------|--------------------|-----------|
| 10 | **Mi perfil** | `/mi-perfil` | Datos de la cuenta; editar nombre y datos personales | `GET /users/me`, `PATCH /users/me` |
| 11 | **Seguridad (cambiar contraseña)** | `/mi-perfil/seguridad` | Cambiar la clave actual; al cambiarla se cierran las demás sesiones | `POST /users/me/password` |
| 12 | **Centro de notificaciones** | `/notificaciones` | Historial propio de notificaciones (correos enviados y su estado), marcar como leídas; el badge del header usa el conteo | `GET /notifications/mine`, `POST /notifications/:id/read`, `GET /notifications/unread-count` |
| 13 | **Checkout** | `/checkout` | Genera la intención de pago y redirige a la pasarela (checkout alojado) | `POST /payments/checkout` |
| 14 | **Mis pagos** | `/mis-pagos` | Historial de compras propias | `GET /payments/mine` |
| 15 | **Detalle de pago** | `/mis-pagos/:id` | Estado del pago, sus reembolsos y botón "Solicitar reembolso" (total o parcial) | `GET /payments/:id`, `POST /payments/:id/refund`, `GET /payments/:id/refunds` |

### Vistas específicas del voluntario

| # | Vista | Ruta sugerida | Qué muestra / hace | Endpoints |
|---|-------|---------------|--------------------|-----------|
| 16 | **Mis jornadas** | `/voluntariado/mis-jornadas` | Mis inscripciones a jornadas de limpieza; inscribirme o cancelar; acceder a la jornada | `GET /volunteer/mine`, `POST /volunteer/:id/signup`, `DELETE /volunteer/:id/signup` |

---

# 3. Panel del socio (artesano / emprendedor)

| # | Vista | Ruta sugerida | Qué muestra / hace | Endpoints |
|---|-------|---------------|--------------------|-----------|
| 17 | **Dashboard del socio** | `/socio` | Resumen: estado de mi ficha, nº de productos, publicación/borradores y accesos rápidos | `GET /entrepreneurs/mine`, `GET /products/mine` |
| 18 | **Mi ficha de emprendimiento** | `/socio/mi-ficha` | Crear la ficha del taller y editarla; muestra el estado (borrador / en revisión / publicado / suspendido) | `POST /entrepreneurs`, `GET /entrepreneurs/:id`, `PATCH /entrepreneurs/:id` |
| 19 | **Reenviar ficha a revisión** | `/socio/mi-ficha/revisar` | Tras un rechazo, corregir y volver a enviar | `POST /entrepreneurs/:id/resubmit` |
| 20 | **Historial / auditoría de la ficha** | `/socio/mi-ficha/historial` | Quién aprobó, rechazó o suspendió, cuándo y por qué | `GET /entrepreneurs/:id/history` |
| 21 | **Mi taller (productos)** | `/socio/mis-productos` | Mis productos con su estado (borrador / publicado / despublicado); crear y eliminar | `GET /products/mine`, `POST /products`, `DELETE /products/:id` |
| 22 | **Editor de producto** | `/socio/mis-productos/:id/editar` | Editar un producto (materia prima o artesanía), imágenes y luego publicar/despublicar | `GET /products/:id`, `PATCH /products/:id`, `POST /products/:id/publish`, `POST /products/:id/unpublish` |
| 23 | **Mis ventas / pagos recibidos** | `/socio/mis-ventas` | Pagos asociados a mis productos | `GET /payments/mine` (filtrado por producto del socio) |

---

# 4. Panel de administración

Solo `Admin`. Cubre el ciclo completo: personas, fichas, productos, jornadas, material,
campañas, pagos y correos.

| # | Vista | Ruta sugerida | Qué muestra / hace | Endpoints |
|---|-------|---------------|--------------------|-----------|
| 24 | **Dashboard / Overview** | `/admin` | Resumen del panel: métricas clave del día | `GET /admin/overview` |
| 25 | **Reporte de actividad** | `/admin/reportes/actividad` | Actividad reciente de todo el sistema | `GET /admin/reports/activity` |
| 26 | **Reporte de usuarios** | `/admin/reportes/usuarios` | Métricas de cuentas, roles y registros | `GET /admin/reports/users` |
| 27 | **Reporte de emprendimientos** | `/admin/reportes/socios` | Fichas creadas, aprobadas, rechazadas | `GET /admin/reports/entrepreneurs` |
| 28 | **Reporte de pagos** | `/admin/reportes/pagos` | Volumen, estados y reembolsos | `GET /admin/reports/payments` |
| 29 | **Reporte de voluntariado** | `/admin/reportes/voluntariado` | Jornadas, inscripciones y material recolectado | `GET /admin/reports/volunteer` |
| 30 | **Usuarios** | `/admin/usuarios` | Listar usuarios, buscar, ver detalle | `GET /admin/users`, `GET /admin/users/:id` |
| 31 | **Detalle / gestión de usuario** | `/admin/usuarios/:id` | Cambiar rol y activar o desactivar la cuenta (surte efecto inmediato) | `PATCH /admin/users/:id/role`, `PATCH /admin/users/:id/status` |
| 32 | **Revisión de fichas de socios** | `/admin/revision-socios` | Cola de fichas pendientes; aprobar / rechazar (con motivo) / suspender | `GET /entrepreneurs/admin/review`, `POST /entrepreneurs/:id/approve`, `POST /entrepreneurs/:id/reject`, `POST /entrepreneurs/:id/suspend` |
| 33 | **Fichas archivadas** | `/admin/revision-socios/archivados` | Bandeja de fichas archivadas; restaurar | `GET /entrepreneurs/admin/archived`, `POST /entrepreneurs/:id/restore` |
| 34 | **Moderación de productos** | `/admin/moderacion` | Productos a moderar; despublicar o restaurar los archivados | `GET /admin/moderation/products`, `POST /admin/moderation/products/:id/unpublish`, `POST /admin/moderation/products/:id/restore` |
| 35 | **Jornadas de limpieza** | `/admin/jornadas` | Crear, editar y gestionar jornadas: abrir/cerrar inscripciones, finalizar, archivar, restaurar | `GET /volunteer`, `POST /volunteer`, `PATCH /volunteer/:id`, `POST /volunteer/:id/open`, `POST /volunteer/:id/close`, `POST /volunteer/:id/finish`, `DELETE /volunteer/:id`, `POST /volunteer/:id/restore`, `GET /volunteer/admin/archived` |
| 36 | **Inscripciones de una jornada** | `/admin/jornadas/:id/inscripciones` | Inscripciones; confirmar o rechazar cada una | `GET /volunteer/admin/signups`, `POST /volunteer/signups/:id/confirm`, `POST /volunteer/signups/:id/reject` |
| 37 | **Material recolectado** | `/admin/jornadas/:id/recoleccion` | Registrar qué y cuánto se recolectó (gramos/kg) y **vincularlo a la materia prima**; editar y desvincular | `POST /volunteer/admin/activities/:id/collections`, `GET /volunteer/admin/collections`, `PATCH /volunteer/admin/collections/:id`, `DELETE /volunteer/admin/collections/:id/unlink` |
| 38 | **Resumen de material** | `/admin/recoleccion/resumen` | Totales recolectados por material — la traza del ciclo | `GET /volunteer/admin/collections/summary` |
| 39 | **Campañas** | `/admin/campanas` | Crear, editar, publicar, cerrar, difundir por correo (`notify`), archivar y restaurar | `GET /campaigns`, `POST /campaigns`, `GET /campaigns/:id`, `PATCH /campaigns/:id`, `POST /campaigns/:id/publish`, `POST /campaigns/:id/close`, `POST /campaigns/:id/notify`, `DELETE /campaigns/:id`, `POST /campaigns/:id/restore`, `GET /campaigns/admin/archived` |
| 40 | **Pagos (todos)** | `/admin/pagos` | Todos los pagos del sistema, con su detalle | `GET /payments/admin/list` |
| 41 | **Categorías de productos** | `/admin/categorias` | Crear, editar y desactivar categorías (solo admin); ver árbol y conteos | `POST /product-categories`, `PATCH /product-categories/:id`, `DELETE /product-categories/:id`, `GET /product-categories/public/tree`, `GET /product-categories/public/counts` |
| 42 | **Notificaciones / correos** | `/admin/notificaciones` | Log de envíos, estadísticas, estado del SMTP, probar envío, reenviar y **enviar correo a todos** | `GET /notifications/admin/list`, `GET /notifications/admin/stats`, `GET /notifications/admin/smtp`, `POST /notifications/admin/test`, `POST /notifications/admin/:id/resend`, `POST /admin/notifications/broadcast` |

---

# 5. Vistas transversales de autenticación

| # | Vista | Ruta sugerida | Qué muestra / hace | Endpoints |
|---|-------|---------------|--------------------|-----------|
| 43 | **Login** | `/login` | Inicia sesión; **403** → redirigir a verificación de correo, **401** → error de credenciales | `POST /auth/login` |
| 44 | **Registro** | `/registro` | Crea la cuenta (sin token aún; exige verificar el correo) | `POST /auth/register` |
| 45 | **Verificar correo** | `/verificar` | Ingresar el código de 6 dígitos (15 min, 5 intentos); botón reenviar (espera 60 s) | `POST /auth/verify-email`, `POST /auth/resend-verification` |
| 46 | **Recuperar contraseña** | `/recuperar` | Pedir código y cambiarla; al cambiarla se cierran las demás sesiones | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| 47 | **Roles** (opcional) | `—` | Selector de rol en el registro (no incluye `admin`) | `GET /auth/roles`, `GET /users/roles` |

---

## Checklist por rol

Para validar que el frontend está completo, cada rol debe poder llegar a sus vistas:

- **Visitante (sin sesión):** 1–9, 43, 44, 46 (público; el resto pide login).
- **Comprador:** 10–15 (puede comprar cualquier producto publicado).
- **Voluntario:** 10–16 (se inscribe a jornadas).
- **Socio:** 10–23 (ficha propia, taller, productos y ventas).
- **Admin:** 10, 12, 24–42 (gestiona personas, fichas, productos, jornadas, material, campañas,
  pagos, categorías y correos).

> **Reglas del modelo que las vistas deben respetar:**
> — Fichas y productos requieren aprobación de un admin antes de hacerse públicos.
> — Nada se borra de verdad: todo se archiva (`deletedAt`) y puede restaurarse.
> — Los correos nunca rompen un flujo: si el SMTP falla, la notificación queda `fallida`/`omitida`
>   y la vista del admin lo muestra.
> — La traza jornada → recolectado → materia prima → artesanía debe poder recorrerse en ambas
>   direcciones desde los detalles de producto, ficha y jornada.