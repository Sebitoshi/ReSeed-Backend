import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Transporte SMTP (Gmail por defecto). Toda la configuracion viene del .env.
 * Este servicio solo sabe enviar; el manejo de errores y el registro en BD
 * vive en NotificationsService.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  /** Solo hay transporte si hay usuario y clave de aplicacion. */
  get isConfigured(): boolean {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  /** Permite cortar el envio sin borrar las credenciales (util en tests). */
  get isEnabled(): boolean {
    return this.isConfigured && process.env.SMTP_ENABLED !== 'false';
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const secure = process.env.SMTP_SECURE === 'true';
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 587),
        secure,
        auth: {
          user: process.env.SMTP_USER ?? '',
          pass: process.env.SMTP_PASS ?? '',
        },
        // Gmail rechaza conexiones sin cifrar si no usamos SSL directo.
        requireTLS: !secure,
        // Gmail limita la cantidad de mensajes por conexion.
        pool: true,
        maxConnections: 1,
      });
    }
    return this.transporter;
  }

  /** Comprobacion manual desde el panel admin. */
  async verify(): Promise<void> {
    await this.getTransporter().verify();
  }

  async send(to: string, subject: string, html: string, text?: string): Promise<void> {
    if (!this.isEnabled) {
      throw new Error('SMTP no habilitado (revisa SMTP_USER / SMTP_PASS / SMTP_ENABLED)');
    }
    const from = `"${process.env.SMTP_FROM_NAME ?? 'Reseed'}" <${
      process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER
    }>`;
    try {
      await this.getTransporter().sendMail({ from, to, subject, html, text });
      this.logger.log(`Correo enviado a ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Fallo el envio a ${to}: ${(err as Error).message}`);
      throw err;
    }
  }
}
