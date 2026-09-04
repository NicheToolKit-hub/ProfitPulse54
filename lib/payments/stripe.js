import Stripe from 'stripe';
import { PaymentProvider } from './provider';

// Money is stored as integer minor units (cents) everywhere.
export class StripeProvider extends PaymentProvider {
  constructor() {
    super();
    this._key = process.env.STRIPE_SECRET_KEY || '';
    this._client = this._key ? new Stripe(this._key) : null;
  }

  get id() {
    return 'stripe';
  }

  isConfigured() {
    return Boolean(this._client);
  }

  async createCheckout(invoice, urls) {
    if (!this._client) throw new Error('Stripe is not configured');
    const session = await this._client.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: (invoice.lines || []).map((x) => ({
          quantity: x.quantity,
          price_data: {
            currency: invoice.currency || 'usd',
            unit_amount: x.unitAmount,
            product_data: { name: x.description },
          },
        })),
        metadata: {
          invoiceId: String(invoice.id),
          invoiceNumber: invoice.number,
          tenantId: String(invoice.tenantId),
        },
        payment_intent_data: {
          metadata: { invoiceId: String(invoice.id), tenantId: String(invoice.tenantId) },
        },
        success_url: `${urls.base}?paid=1&invoice=${invoice.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${urls.base}?cancelled=1&invoice=${invoice.id}`,
      },
      { idempotencyKey: `invoice-checkout-${invoice.id}` }
    );
    return { provider: 'stripe', sessionId: session.id, url: session.url };
  }

  async verifyWebhook(request) {
    const raw = await request.text();
    const signature = request.headers.get('stripe-signature');
    return Stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  }
}
