/**
 * Contrato que toda pasarela real (Mercado Pago, PayU, Wompi, Stripe, ...)
 * debe implementar para enchufarse al modulo de pagos sin tocar el resto.
 */
export interface GatewaySession {
  /** URL a la que redirigimos al comprador (checkout hosted). */
  checkoutUrl: string;

  /** Referencia externa que la pasarela usara para identificar el pago. */
  externalRef: string;
}

export interface GatewayWebhookEvent {
  externalRef: string;

  /** Estado que la pasarela reporta para la transaccion. */
  outcome: 'approved' | 'rejected' | 'cancelled' | 'refunded';

  /** Monto en centavos que la pasarela confirma (para conciliar). */
  amountCents?: number;

  /** Referencia externa del refund, si el evento es de reembolso. */
  refundExternalRef?: string;

  /** Cuerpo crudo tal cual lo envió la pasarela (se guarda en el log). */
  raw?: unknown;
}

export interface CreateCheckoutInput {
  amountCents: number;
  currency: string;
  description?: string;
  /** Id generado por nosotros; la pasarela lo debe devolver en el webhook. */
  externalRef: string;
  metadata?: Record<string, string>;
}

export interface GatewayProvider {
  readonly name: string;

  /** Crea el checkout hosted y devuelve la URL + referencia externa. */
  createCheckout(input: CreateCheckoutInput): Promise<GatewaySession>;

  /** Valida la firma del webhook y devuelve el evento tipado. */
  parseAndVerifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): GatewayWebhookEvent;

  /** Realiza un refund en la pasarela; exitoso => externalRef del refund. */
  createRefund(paymentExternalRef: string, amountCents: number): Promise<{ refundExternalRef: string }>;
}
