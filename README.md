<p align="center">
  <img src="https://img.shields.io/badge/Reseed-Recolecci%C3%B3n%2C%20materia%20prima%20y%20artesan%C3%ADa-16a34a?style=for-the-badge" alt="Reseed" />
</p>

<h1 align="center">🌱 Reseed</h1>

<p align="center">
  <b>De la basura a la artesanía.</b><br/>
  Jornadas de limpieza que recolectan reciclables, los transforman en materia prima<br/>
  y la venden a los socios que fabrican los productos de la plataforma.
</p>

<p align="center">
  <a href="#-español">Español</a> ·
  <a href="#-english">English</a> ·
  <a href="DOCUMENTATION.md">Documentación técnica</a>
</p>

---

## 🇪🇸 Español

### La idea en una frase

Reseed **no es simplemente una tienda**. Es un ciclo: juntamos los reciclables que la comunidad recolecta en jornadas de limpieza, los convertimos en **materia prima**, se la vendemos a nuestros **socios artesanos**, y ellos la transforman en productos artesanales que se publican aquí.

Cada compra respalda un **barrio más limpio** y un oficio que se mantiene vivo.

### El ciclo completo

```
  🧹 Jornadas de limpieza          🏭 Transformamos            🤝 Vendemos materia prima     🎨 Los socios fabrican
     de la comunidad          ───►  lo recolectado       ───►   a nuestros socios       ───►  productos artesanales
     (voluntariados)                en materia prima            de la comunidad              y se publican aquí
```

1. **Jornadas de limpieza** — Se abren al público. Los voluntarios se inscriben, van al punto de encuentro y recolectan reciclables.
2. **Transformación** — La plataforma registra **qué se recolectó en cada jornada**: PET, aluminio, cartón, vidrio y más, con su cantidad. Ese material se procesa y se convierte en materia prima.
3. **Venta a los socios** — La materia prima se publica como producto y se vende a los **socios**, que son los artesanos de la comunidad.
4. **Artesanías** — Los socios transforman esa materia prima en productos terminados, y esos productos son los que ve el público en el catálogo.

### La traza que lo sostiene

Lo que hace distinto a Reseed es que **nada se pierde por el camino**. Cada recolección queda ligada al producto de materia prima en el que se convirtió:

```
Jornada del 15 de noviembre
  └─ 25 kg de PET  ─────►  "Fibra de PET triturada"  ─────►  socio "Taller Manos del Río"
     320 latas                        (materia prima)              └─► Hamaca reciclada
     18 bultos de cartón                                                          └─► publicada en la plataforma
```

Se puede responder, en cualquier momento: **¿de qué jornada salió el material de este producto?** o **¿qué se recolectó esa vez?** El detalle queda a la vista de todos.

### Los cuatro roles

| Rol | Qué hace |
|---|---|
| 🧹 **Voluntario** | Se inscribe en las jornadas de limpieza y va a recolectar. |
| 🎨 **Socio / Emprendedor** | Compra materia prima, fabrica productos artesanales y los publica. |
| 🛒 **Comprador** | Explora el catálogo y compra productos terminados. |
| 🛡️ **Administrador** | Publica jornadas, registra lo recolectado, aprueba fichas y modera todo. |

> El rol de administrador **no se puede auto-asignar** al registrarse. Se crea con una herramienta interna.

### ¿Qué se vende en la plataforma?

| | |
|---|---|
| 🧵 **Materia prima** | Fibra reciclada, cartón procesado, plástico triturado y similares. Se la compran los socios. |
| 🎨 **Artesanías** | Productos terminados que los socios fabrican con esa materia prima. |
| 🌿 **Campañas** | Iniciativas solidarias que se muestran al público y se difunden por correo a toda la comunidad. |

### Qué cuida el proyecto

- **Nada llega al público sin pasar por un humano.** Toda ficha de socio y todo producto empieza en borrador y solo se publica cuando un administrador lo aprueba.
- **Todo queda registrado.** Cada cambio de estado guarda quién lo hizo, cuándo y por qué.
- **Los avisos no bloquean nada.** Si el correo falla al confirmar un pago o aprobar una ficha, el registro en base de datos ya quedó hecho y la operación continúa con normalidad.
- **Cada persona confirma su correo.** Al registrarse recibe un código de 6 dígitos por correo; al ingresarlo su cuenta queda activa.
- **Si olvidas tu contraseña, la recuperas.** Te enviamos un código al correo y, al usarlo, cambias la contraseña y cerramos las demás sesiones abiertas.

### Empezar

Para poner el proyecto en marcha, la configuración y los comandos, visita la **[documentación técnica →](DOCUMENTATION.md)**

### Documentación de la API

La API está documentada en español y se puede explorar de forma interactiva. Con el servidor corriendo, abre:

```
http://localhost:3000/docs
```

Desde ahí puedes ver cada endpoint, qué necesita token y **probarlo directamente** desde el navegador.

---

## 🇬🇧 English

### The idea in one sentence

Reseed **is not just a store**. It is a cycle: we gather the recyclables that the community collects during clean-up events, turn them into **raw material**, sell it to our **artisan partners**, and they craft the products published here.

Every purchase backs a **cleaner neighbourhood** and a living craft.

### The full cycle

```
  🧹 Community clean-up         🏭 We transform          🤝 We sell raw material     🎨 Partners craft
     events                  ───►  what was collected ──►  to our partners       ───►  artisan products
     (volunteering)                into raw material        in the community            published here
```

1. **Clean-up events** — Open to the public. Volunteers sign up, show up at the meeting point and collect recyclables.
2. **Transformation** — The platform records **what each event collected**: PET, aluminium, cardboard, glass and more, with quantities. That material is processed into raw material.
3. **Sales to partners** — The raw material is listed as a product and sold to our **partners**, the community's artisans.
4. **Crafts** — Partners turn that raw material into finished products, and those are what the public sees in the catalog.

### The traceability behind it

What sets Reseed apart is that **nothing gets lost along the way**. Each collection is linked to the raw material product it became:

```
15 November event
  └─ 25 kg of PET  ─────►  "Shredded PET fibre"  ─────►  partner "Taller Manos del Río"
     320 cans                       (raw material)           └─► Recycled hammock
     18 bales of cardboard                                                            └─► published on the platform
```

At any moment you can answer: **which event did this product's material come from?** or **what was collected that day?** The detail is public.

### The four roles

| Role | What they do |
|---|---|
| 🧹 **Volunteer** | Signs up for clean-up events and goes out to collect. |
| 🎨 **Partner / Entrepreneur** | Buys raw material, crafts artisan products and lists them. |
| 🛒 **Buyer** | Browses the catalog and buys finished products. |
| 🛡️ **Administrator** | Publishes events, records collections, approves profiles and moderates everything. |

> The administrator role **cannot be self-assigned** when registering. It is created through an internal tool.

### What is sold on the platform?

| | |
|---|---|
| 🧵 **Raw material** | Recycled fibre, processed cardboard, shredded plastic and similar. Purchased by partners. |
| 🎨 **Crafts** | Finished products that partners make from that raw material. |
| 🌿 **Campaigns** | Solidarity initiatives shown to the public and shared by email with the whole community. |

### What the project cares about

- **Nothing reaches the public without a human checking it.** Every partner profile and every product starts as a draft and is only published once an administrator approves it.
- **Everything is recorded.** Every status change stores who did it, when and why.
- **Notifications never block anything.** If the mail service fails when confirming a payment or approving a profile, the database record is already saved and the operation continues normally.
- **Everyone confirms their email.** When signing up you receive a 6-digit code by email; entering it activates your account.
- **Forgot your password? Recover it.** We send a code to your email; using it changes your password and closes any other open sessions.

### Getting started

For setup instructions, configuration and commands, see the **[technical documentation →](DOCUMENTATION.md)**

### API Documentation

The API is documented in Spanish and can be explored interactively. With the server running, open:

```
http://localhost:3000/docs
```

There you can see every endpoint, know which ones require a token, and **try them right from your browser**.

---

<p align="center">
  Built with <a href="https://nestjs.com/">NestJS</a> · TypeScript · PostgreSQL
</p>
