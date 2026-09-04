// Payment provider abstraction — add PayPal/Square by implementing this interface.
// Each provider only needs createCheckout() + verifyWebhook(); ledger posting stays
// provider-neutral in the API layer.
export class PaymentProvider {
  get id() {
    return 'base';
  }
  isConfigured() {
    return false;
  }
  async createCheckout(_invoice, _urls) {
    throw new Error('createCheckout not implemented');
  }
  async verifyWebhook(_request) {
    throw new Error('verifyWebhook not implemented');
  }
}
