import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import type {
  CreateCheckoutInput,
  GatewayProvider,
  GatewaySession,
  GatewayWebhookEvent,
} from './payment-gateway.interface.js';

/**
 * Pasarela simulada para desarrollo y pruebas.
 * - Crea "checkouts" falsos que apuntan a una URL con el externalRef.
 * - Firma webhooks con HMAC-SHA256 sobre el cuerpo crudo (como Stripe/MP).
 *   El webhook se dispara manualmente en dev con:
 *     curl -X POST /payments/webhook/dummy -H "X-Dummy-Signature: <hmac>" -d '<body>'
 * - createRefund devuelve un externalRef determinista: refund-<pago>-<monto>.
 */
@Injectable()
export class DummyGateway implements GatewayProvider {
  readonly name = 'dummy';

  private secret(): string {
    return process.env.PAYMENTS_DUMMY_SECRET ?? 'dummy-webhook-secret';
  }

  async createCheckout(input: CreateCheckoutInput): Promise<GatewaySession> {
    const base = process.env.PAYMENTS_DUMMY_CHECKOUT_BASE ?? 'https://sandbox.dummy-gw.test/checkout';
    return {
      checkoutUrl: `${base}/${input.externalRef}?amount=${input.amountCents}`,
      externalRef: input.externalRef,
    };
  }

  parseAndVerifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): GatewayWebhookEvent {
    const sigHeader = (Array.isArray(headers['x-dummy-signature'])
      ? (headers['x-dummy-signature'] as string[])[0]
      : headers['x-dummy-signature']) as string | undefined;
    if (!sigHeader) {
      throw new BadRequestException('Webhook sin firma (X-Dummy-Signature)');
    }
    const expected = crypto
      .createHmac('sha256', this.secret())
      .update(rawBody, 'utf8')
      .digest('hex');
    const a = Buffer.from(sigHeader);
    const b = Buffer.from(expected);
    // timingSafeEqual evita filtrar la firma por timing; requiere igual longitud.
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new BadRequestException('Firma de webhook invalida');
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Body de webhook no es JSON valido');
    }

    const externalRef = typeof body.externalRef === 'string' ? body.externalRef : '';
    if (!externalRef) throw new BadRequestException('Webhook sin externalRef');
    const outcome = body.outcome;
    if (
      outcome !== 'approved' &&
      outcome !== 'rejected' &&
      outcome !== 'cancelled' &&
      outcome !== 'refunded'
    ) {
      throw new BadRequestException('outcome invalido');
    }
    return {
      externalRef,
      outcome,
      amountCents: typeof body.amountCents === 'number' ? body.amountCents : undefined,
      refundExternalRef: typeof body.refundExternalRef === 'string' ? body.refundExternalRef : undefined,
      raw: body,
    };
  }

  async createRefund(paymentExternalRef: string, amountCents: number) {
    return { refundExternalRef: `rfnd-${paymentExternalRef}-${amountCents}` };
  }
}
