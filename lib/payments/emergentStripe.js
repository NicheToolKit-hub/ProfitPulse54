import { PaymentProvider } from './provider';

// Emergent-managed Stripe (claimable sandbox).
// STRIPE_API_KEY === "sk_test_emergent" routes to the Emergent integration proxy,
// which holds the real Stripe credentials. We speak Stripe's form-encoded REST API
// directly against the proxy so no Stripe SDK host-hacking is needed.
const PROXY = (process.env.INTEGRATION_PROXY_URL || 'https://integrations.emergentagent.com').replace(/\/$/, '');
const API_BASE = `${PROXY}/stripe/v1`;

function authHeader() {
  const key = process.env.STRIPE_API_KEY || '';
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export class EmergentStripeProvider extends PaymentProvider {
  get id() {
    return 'stripe';
  }
  isConfigured() {
    return Boolean(process.env.STRIPE_API_KEY);
  }

  async createCheckout(invoice, { base, metadata = {} }) {
    if (!this.isConfigured()) throw new Error('Emergent Stripe is not configured');
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${base}/?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${base}/?cancelled=1`);
    params.append('payment_method_types[0]', 'card');

    const lines = invoice.lines && invoice.lines.length
      ? invoice.lines
      : [{ description: `Invoice ${invoice.number || ''}`.trim() || 'Invoice payment', quantity: 1, unitAmount: invoice.total }];
    lines.forEach((l, i) => {
      params.append(`line_items[${i}][price_data][currency]`, invoice.currency || 'usd');
      params.append(`line_items[${i}][price_data][product_data][name]`, l.description || 'Item');
      params.append(`line_items[${i}][price_data][unit_amount]`, String(l.unitAmount));
      params.append(`line_items[${i}][quantity]`, String(l.quantity || 1));
    });
    Object.entries(metadata).forEach(([k, v]) => params.append(`metadata[${k}]`, String(v)));

    const res = await fetch(`${API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Stripe checkout failed');
    return { provider: 'stripe', sessionId: data.id, url: data.url };
  }

  async getStatus(sessionId) {
    const res = await fetch(`${API_BASE}/checkout/sessions/${sessionId}`, {
      headers: { Authorization: authHeader() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to fetch session');
    return {
      status: data.status, // open | complete | expired
      paymentStatus: data.payment_status, // paid | unpaid | no_payment_required
      amountTotal: data.amount_total,
      currency: data.currency,
      metadata: data.metadata || {},
    };
  }
}
