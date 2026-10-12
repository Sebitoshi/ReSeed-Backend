/**
 * Plantillas HTML en espanol para todos los correos de la plataforma.
 * Son texto plano + un layout comun para que todos se vean igual.
 */

export interface EmailContent {
  title: string;
  greeting?: string;
  /** Parrafos HTML (ya escapados por quien llama). */
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  /** Lista de pares etiqueta/valor (ej. Monto, Estado). */
  details?: Array<{ label: string; value: string }>;
  footerNote?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detailsHtml(details: NonNullable<EmailContent['details']>): string {
  if (details.length === 0) return '';
  const rows = details
    .map(
      (d) => `
        <tr>
          <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #f3f4f6">${escapeHtml(d.label)}</td>
          <td style="padding:8px 12px;color:#111827;border-bottom:1px solid #f3f4f6;text-align:right">${escapeHtml(d.value)}</td>
        </tr>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse">
      ${rows}
    </table>`;
}

function ctaHtml(label?: string, url?: string): string {
  if (!label || !url) return '';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0">
      <tr>
        <td style="border-radius:8px;background:#16a34a">
          <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Cuerpo HTML completo listo para nodemailer. */
export function renderEmail(content: EmailContent): string {
  const greeting = content.greeting
    ? `<p style="margin:0 0 12px;font-size:16px;color:#111827">${escapeHtml(content.greeting)}</p>`
    : '';
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151">${p}</p>`)
    .join('');
  const footer = content.footerNote
    ? `<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">${escapeHtml(content.footerNote)}</p>`
    : '';

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827">${escapeHtml(content.title)}</h1>
      ${greeting}
      ${paragraphs}
      ${detailsHtml(content.details ?? [])}
      ${ctaHtml(content.ctaLabel, content.ctaUrl)}
      ${footer}
    </div>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#9ca3af;text-align:center">
      Estas recibiendo este correo porque tienes una cuenta en Reseed.
    </p>
  </div>`;
}

/** Version sin formato, para clientes de texto y para el registro en BD. */
export function renderPlainText(content: EmailContent): string {
  const lines = [content.title, ''];
  if (content.greeting) lines.push(content.greeting, '');
  for (const p of content.paragraphs) {
    lines.push(p.replace(/<[^>]+>/g, ''), '');
  }
  for (const d of content.details ?? []) {
    lines.push(`${d.label}: ${d.value}`);
  }
  if (content.ctaLabel && content.ctaUrl) lines.push('', `${content.ctaLabel}: ${content.ctaUrl}`);
  return lines.join('\n');
}

export function money(cents: number, currency = 'COP'): string {
  const abs = Math.abs(Math.trunc(cents));
  const sign = cents < 0 ? '-' : '';
  return `${sign}${Math.floor(abs / 100)}.${`${abs % 100}`.padStart(2, '0')} ${currency}`;
}

export const templates = {
  recuperacionClave(name: string, code: string, minutos: number): EmailContent {
    const codeHtml = `<p style="margin:20px 0;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;letter-spacing:8px;color:#111827;font-weight:700">${escapeHtml(code)}</p>`;
    return {
      title: 'Recupera tu contrasena',
      greeting: `Hola ${name},`,
      paragraphs: [
        'Recibimos una solicitud para restablecer tu contrasena en Reseed. Usa el siguiente codigo:',
        codeHtml,
        `El codigo caduca en ${minutos} minutos. Al cambiar la contrasena, cerraremos las sesiones abiertas en otros dispositivos.`,
        'Si no pediste esto, ignora el correo: tu contrasena no cambiara y puedes solicitar otro codigo cuando quieras.',
      ],
    };
  },

  claveCambiada(name: string, appUrl: string): EmailContent {
    return {
      title: 'Tu contrasena fue cambiada',
      greeting: `Hola ${name},`,
      paragraphs: [
        'Restablecimos tu contrasena en Reseed y cerramos las sesiones abiertas en otros dispositivos.',
        'Si no fuiste tu, contacta al equipo de inmediato: alguien mas pudo tener acceso a tu cuenta.',
      ],
      ctaLabel: 'Ir a la plataforma',
      ctaUrl: appUrl,
    };
  },

  verificacionCodigo(name: string, code: string, minutos: number): EmailContent {
    // El codigo se muestra en grande y con monoespaciado para que sea copiable.
    const codeHtml = `<p style="margin:20px 0;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;letter-spacing:8px;color:#111827;font-weight:700">${escapeHtml(code)}</p>`;
    return {
      title: 'Confirma tu correo',
      greeting: `Hola ${name},`,
      paragraphs: [
        'Usa el siguiente codigo para verificar tu correo y activar tu cuenta en Reseed.',
        codeHtml,
        `El codigo caduca en ${minutos} minutos. Si no solicitaste este registro, puedes ignorar este correo.`,
      ],
    };
  },

  bienvenida(name: string, appUrl: string): EmailContent {
    return {
      title: 'Bienvenido a Reseed',
      greeting: `Hola ${name},`,
      paragraphs: [
        'Tu cuenta ya esta creada. Reseed conecta emprendimientos locales con personas que quieren apoyarlos, colaborar como voluntarios y participar en campanas.',
        'Ya puedes explorar el directorio de emprendimientos, el catalogo de productos o postular tu propio emprendimiento.',
      ],
      ctaLabel: 'Ir a la plataforma',
      ctaUrl: appUrl,
    };
  },

  emprendimientoRevisado(
    name: string,
    emprendimiento: string,
    accion: 'aprobado' | 'rechazado' | 'suspendido',
    note: string | null,
    appUrl: string,
  ): EmailContent {
    const textos: Record<typeof accion, { title: string; body: string }> = {
      aprobado: {
        title: 'Tu emprendimiento fue aprobado',
        body: 'Revisamos tu ficha y ya forma parte del directorio publico de Reseed. Ademas, ya puedes publicar productos en el catalogo.',
      },
      rechazado: {
        title: 'Tu emprendimiento fue rechazado',
        body: 'Lamentamos comunicarte que tu solicitud no fue aprobada en esta ocasion. Puedes corregir los puntos indicados y volver a enviarla.',
      },
      suspendido: {
        title: 'Tu emprendimiento fue suspendido',
        body: 'Tu ficha dejo de mostrarse en el directorio publico. Revisa el motivo indicado y contacta al equipo si crees que es un error.',
      },
    };
    const t = textos[accion];
    const details = [{ label: 'Emprendimiento', value: emprendimiento }];
    if (note) details.push({ label: 'Motivo del equipo', value: note });
    return {
      title: t.title,
      greeting: `Hola ${name},`,
      paragraphs: [t.body],
      details,
      ctaLabel: 'Ver mi emprendimiento',
      ctaUrl: `${appUrl}/emprendimientos`,
    };
  },

  pagoIniciado(
    name: string,
    monto: string,
    descripcion: string | null,
    checkoutUrl: string,
  ): EmailContent {
    const details = [{ label: 'Monto', value: monto }];
    if (descripcion) details.push({ label: 'Descripcion', value: descripcion });
    return {
      title: 'Tu pago esta por comenzar',
      greeting: `Hola ${name},`,
      paragraphs: [
        'Recibimos tu intencion de pago. Completa el proceso desde el checkout seguro para finalizar la compra.',
        'Si no iniciaste este pago, puedes ignorar este correo.',
      ],
      details,
      ctaLabel: 'Ir al checkout',
      ctaUrl: checkoutUrl,
    };
  },

  pagoConfirmado(name: string, monto: string, descripcion: string | null): EmailContent {
    const details = [{ label: 'Monto pagado', value: monto }];
    if (descripcion) details.push({ label: 'Descripcion', value: descripcion });
    details.push({ label: 'Estado', value: 'Aprobado' });
    return {
      title: 'Pago confirmado',
      greeting: `Hola ${name},`,
      paragraphs: ['Tu pago se acredito correctamente. Gracias por apoyar a los emprendimientos locales.'],
      details,
    };
  },

  pagoRechazado(name: string, monto: string): EmailContent {
    return {
      title: 'Pago no completado',
      greeting: `Hola ${name},`,
      paragraphs: [
        'El pago no pudo completarse (fue rechazado o cancelado por la pasarela). No se realizo ningun cargo definitivo.',
        'Puedes intentarlo de nuevo desde el catalogo.',
      ],
      details: [
        { label: 'Monto intentado', value: monto },
        { label: 'Estado', value: 'No aprobado' },
      ],
    };
  },

  reembolsoSolicitado(name: string, monto: string, motivo: string | null): EmailContent {
    const details = [{ label: 'Monto reembolsado', value: monto }];
    if (motivo) details.push({ label: 'Motivo', value: motivo });
    return {
      title: 'Reembolso procesado',
      greeting: `Hola ${name},`,
      paragraphs: [
        'Registramos un reembolso sobre uno de tus pagos. El plazo de acreditacion depende del banco emisor.',
      ],
      details,
    };
  },

  voluntariadoInscripcion(name: string, actividad: string): EmailContent {
    return {
      title: 'Inscripcion recibida',
      greeting: `Hola ${name},`,
      paragraphs: [
        'Recibimos tu inscripcion al voluntariado. El organizador la revisara y te avisaremos cuando sea confirmada.',
      ],
      details: [{ label: 'Actividad', value: actividad }],
    };
  },

  voluntariadoConfirmado(
    name: string,
    actividad: string,
    fecha: string | null,
    lugar: string | null,
    appUrl: string,
  ): EmailContent {
    const details = [{ label: 'Actividad', value: actividad }];
    if (fecha) details.push({ label: 'Fecha', value: fecha });
    if (lugar) details.push({ label: 'Lugar', value: lugar });
    return {
      title: 'Tu inscripcion fue confirmada',
      greeting: `Hola ${name},`,
      paragraphs: ['¡Listo! Ya eres parte de esta actividad de voluntariado. Nos vemos alli.'],
      details,
      ctaLabel: 'Ver mis voluntariados',
      ctaUrl: `${appUrl}/voluntariados`,
    };
  },

  voluntariadoRechazado(name: string, actividad: string, motivo: string | null): EmailContent {
    const details = [{ label: 'Actividad', value: actividad }];
    if (motivo) details.push({ label: 'Motivo', value: motivo });
    return {
      title: 'Tu inscripcion no fue confirmada',
      greeting: `Hola ${name},`,
      paragraphs: [
        'No pudimos confirmar tu inscripcion a esta actividad. Puedes inscribirte a otra de las disponibles.',
      ],
      details,
    };
  },

  campana(
    name: string,
    titulo: string,
    descripcion: string,
    fechas: string | null,
    campanaUrl: string,
  ): EmailContent {
    const details: Array<{ label: string; value: string }> = [];
    if (fechas) details.push({ label: 'Fechas', value: fechas });
    return {
      title: titulo,
      greeting: `Hola ${name},`,
      paragraphs: [descripcion],
      details,
      ctaLabel: 'Conocer la campana',
      ctaUrl: campanaUrl,
    };
  },

  prueba(adminEmail: string, fecha: string): EmailContent {
    return {
      title: 'Correo de prueba de Reseed',
      greeting: 'Hola,',
      paragraphs: [
        'Si ves este mensaje, el SMTP de Gmail esta configurado correctamente y las notificaciones se enviarian sin problemas.',
      ],
      details: [
        { label: 'Enviado por', value: adminEmail },
        { label: 'Fecha', value: fecha },
      ],
    };
  },
};
