<p align="center">
  <img src="https://img.shields.io/badge/Reseed-Plataforma%20comunitaria-16a34a?style=for-the-badge" alt="Reseed" />
</p>

<h1 align="center">🌱 Reseed</h1>

<p align="center">
  <b>Backend de la plataforma Reseed</b><br/>
  Donde los emprendimientos locales encuentran a la gente que quiere apoyarlos.
</p>

<p align="center">
  <a href="#-español">Español</a> ·
  <a href="#-english">English</a> ·
  <a href="DOCUMENTATION.md">Documentación técnica</a>
</p>

---

## 🇪🇸 Español

### ¿Qué es Reseed?

Reseed es una plataforma que conecta **emprendimientos locales** con personas que quieren apoyarlos: comprando sus productos, colaborando como **voluntarios** o participando en **campañas solidarias**.

Este repositorio contiene el **backend**: la parte que guarda la información, controla quién puede hacer qué y envía los correos. El sitio web que ve el usuario vive en un proyecto aparte.

### ¿Qué se puede hacer?

| | |
|---|---|
| 🏪 **Emprendimientos** | Cada emprendedor crea su ficha y la envía a revisión. Una vez aprobada, aparece en el directorio público y puede vender productos. |
| 🛍️ **Productos** | Catálogo con precios, stock e imágenes. Todo empieza como borrador y solo se publica cuando el emprendimiento está aprobado. |
| 🛒 **Compras** | Los compradores pagan desde un checkout seguro. Reciben la confirmación por correo. |
| 🤝 **Voluntariados** | Se publican jornadas con cupos limitados. El voluntario se inscribe y el organizador confirma o rechaza cada inscripción. |
| 📢 **Campañas** | Iniciativas solidarias que se muestran al público y se pueden difundir por correo a toda la comunidad. |
| ✉️ **Notificaciones** | Cada evento importante deja registro y envía un correo: bienvenida, pagos, resultado de revisiones, voluntariados y campañas. |
| 🛡️ **Panel admin** | Gestión de usuarios y roles, moderación de contenido, difusión de correos y reportes de actividad. |

### Los cuatro roles

| Rol | Qué puede hacer |
|---|---|
| 👤 **Comprador** | Explora el catálogo y compra productos. |
| 🌱 **Emprendedor** | Publica su emprendimiento y sus productos. |
| 🤝 **Voluntario** | Se inscribe en jornadas de voluntariado. |
| 🛡️ **Administrador** | Aprueba fichas, modera contenido, gestiona usuarios y envía notificaciones. |

> El rol de administrador **no se puede auto-asignar** al registrarse. Se crea desde una herramienta interna.

### Cómo funciona la revisión

Reseed está pensado para que **nada llegue al público sin pasar por un humano**:

1. Un emprendedor envía su ficha → queda en estado **pendiente**.
2. Un administrador la **aprueba**, **rechaza** (con motivo) o **suspende**.
3. El emprendedor recibe el correo con la decisión y, si fue rechazado, puede corregir y **reenviar**.
4. Los productos siguen el mismo camino: solo se publican si el emprendimiento está aprobado.

Todo queda registrado en un **historial de auditoría** que responde quién cambió qué, cuándo y por qué.

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

### What is Reseed?

Reseed is a platform that connects **local entrepreneurs** with people who want to support them: buying their products, volunteering, or taking part in **solidarity campaigns**.

This repository holds the **backend** — the part that stores information, controls who can do what, and sends the emails. The website users actually see lives in a separate project.

### What can you do?

| | |
|---|---|
| 🏪 **Entrepreneurs** | Each entrepreneur creates their profile and submits it for review. Once approved, it shows up in the public directory and can sell products. |
| 🛍️ **Products** | A catalog with prices, stock and images. Everything starts as a draft and only gets published once the venture is approved. |
| 🛒 **Purchases** | Buyers pay through a secure checkout and get an email confirmation. |
| 🤝 **Volunteering** | Events with limited spots are published. Volunteers sign up and the organizer confirms or rejects each application. |
| 📢 **Campaigns** | Solidarity initiatives shown to the public and shareable by email with the whole community. |
| ✉️ **Notifications** | Every important event is recorded and emailed: welcome, payments, review outcomes, volunteering and campaigns. |
| 🛡️ **Admin panel** | User and role management, content moderation, email broadcasting and activity reports. |

### The four roles

| Role | What they can do |
|---|---|
| 👤 **Buyer** | Browses the catalog and purchases products. |
| 🌱 **Entrepreneur** | Publishes their venture and its products. |
| 🤝 **Volunteer** | Signs up for volunteering events. |
| 🛡️ **Administrator** | Approves profiles, moderates content, manages users and sends notifications. |

> The administrator role **cannot be self-assigned** when registering. It is created through an internal tool.

### How review works

Reseed is built so that **nothing reaches the public without a human looking at it first**:

1. An entrepreneur submits their profile → it becomes **pending**.
2. An administrator **approves** it, **rejects** it (with a reason), or **suspends** it.
3. The entrepreneur gets an email with the decision, and if it was rejected they can fix it and **resubmit**.
4. Products follow the same path: they only publish if the venture is approved.

Everything is captured in an **audit history** showing who changed what, when, and why.

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
