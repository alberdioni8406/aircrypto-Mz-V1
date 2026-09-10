const fetch = require('node-fetch');
const crypto = require('crypto');
const config = require('../config');

class NOWPaymentsService {
  constructor() {
    this.apiKey = config.nowpayments.apiKey;
    this.ipnSecret = config.nowpayments.ipnSecret;
    this.apiBase = config.nowpayments.apiBase;
  }

  async _request(method, path, body = null) {
    if (!this.apiKey) {
      throw new Error('NOWPayments API key not configured');
    }
    const opts = {
      method,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.apiBase}${path}`, opts);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.message || data?.error || text || res.statusText;
      const err = new Error(`NOWPayments ${method} ${path}: ${res.status} ${msg}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async getStatus() {
    try {
      const data = await this._request('GET', '/status');
      return { ok: true, message: data.message || 'OK' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Create a payment. Amount is in fiat (MZN).
   * pay_currency is the crypto the user will send (BCH preferred).
   */
  async createPayment({
    priceAmount,
    priceCurrency = 'mzn',
    payCurrency,
    orderId,
    orderDescription,
    ipnCallbackUrl,
  }) {
    const body = {
      price_amount: priceAmount,
      price_currency: priceCurrency.toLowerCase(),
      pay_currency: payCurrency.toLowerCase(),
      order_id: orderId,
      order_description: orderDescription || `AirCrypto ${orderId}`,
      ipn_callback_url: ipnCallbackUrl || `${config.publicBaseUrl}/api/webhooks/nowpayments`,
      is_fixed_rate: true,
      is_fee_paid_by_user: false,
    };

    const data = await this._request('POST', '/payment', body);
    return {
      paymentId: String(data.payment_id),
      payAddress: data.pay_address,
      payAmount: data.pay_amount,
      payCurrency: data.pay_currency,
      priceAmount: data.price_amount,
      priceCurrency: data.price_currency,
      expirationEstimateDate: data.expiration_estimate_date,
      network: data.network,
      raw: data,
    };
  }

  async getPaymentStatus(paymentId) {
    return this._request('GET', `/payment/${paymentId}`);
  }

  /**
   * Verify IPN signature.
   * NOWPayments uses HMAC-SHA512 of the sorted JSON body with the IPN secret.
   */
  verifyIpnSignature(rawBody, signature) {
    if (!this.ipnSecret) {
      if (config.isDev) {
        console.warn('[NOWPayments] IPN secret missing — skipping verification in dev');
        return true;
      }
      return false;
    }
    if (!signature) return false;

    let payload;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      return false;
    }

    // Sort keys and stringify the way NOWPayments expects
    const sorted = Object.keys(payload)
      .sort()
      .reduce((acc, key) => {
        acc[key] = payload[key];
        return acc;
      }, {});
    const json = JSON.stringify(sorted);
    const hmac = crypto.createHmac('sha512', this.ipnSecret).update(json).digest('hex');
    return hmac === signature;
  }

  /**
   * Map NOWPayments payment_status to our internal status.
   */
  mapStatus(npStatus) {
    const s = (npStatus || '').toLowerCase();
    if (['finished', 'confirmed'].includes(s)) return 'confirmed';
    if (['failed', 'refunded', 'expired'].includes(s)) return s === 'expired' ? 'expired' : 'failed';
    if (['waiting', 'confirming', 'sending', 'partially_paid'].includes(s)) return 'pending';
    return 'pending';
  }
}

module.exports = new NOWPaymentsService();
