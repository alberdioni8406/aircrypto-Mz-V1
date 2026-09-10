const fetch = require('node-fetch');
const config = require('../../config');
const ProviderService = require('./base');

class ReloadlyService extends ProviderService {
  constructor() {
    super('reloadly');
    this._token = null;
    this._tokenExpires = 0;
  }

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpires - 60_000) {
      return this._token;
    }
    if (!config.reloadly.clientId || !config.reloadly.clientSecret) {
      throw new Error('Reloadly credentials not configured');
    }

    const res = await fetch(config.reloadly.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: config.reloadly.clientId,
        client_secret: config.reloadly.clientSecret,
        grant_type: 'client_credentials',
        audience: config.reloadly.sandbox
          ? 'https://topups-sandbox.reloadly.com'
          : 'https://topups.reloadly.com',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Reloadly auth failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    this._token = data.access_token;
    this._tokenExpires = Date.now() + (data.expires_in || 3600) * 1000;
    return this._token;
  }

  async _request(method, path, body = null) {
    const token = await this._getToken();
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/com.reloadly.topups-v1+json',
        'Content-Type': 'application/json',
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${config.reloadly.apiBase}${path}`, opts);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.message || data?.error || text || res.statusText;
      const err = new Error(`Reloadly ${method} ${path}: ${res.status} ${msg}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async isAvailable() {
    try {
      if (!config.reloadly.clientId || !config.reloadly.clientSecret) return false;
      await this._getToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch operators for Mozambique. Do NOT hard-code operator IDs.
   */
  async getOperators(country = 'MZ') {
    return this._request('GET', `/operators/countries/${country}`);
  }

  async getOperatorByName(name, country = 'MZ') {
    const operators = await this.getOperators(country);
    const lower = name.toLowerCase();
    return operators.find(
      (op) =>
        op.name?.toLowerCase().includes(lower) ||
        op.bundle?.toLowerCase().includes(lower)
    ) || null;
  }

  async getProducts(operatorId) {
    return this._request('GET', `/operators/${operatorId}/products`);
  }

  async getBalance() {
    try {
      const data = await this._request('GET', '/accounts/balance');
      return {
        balance: data.balance,
        currency: data.currencyCode || data.currency,
        raw: data,
      };
    } catch (e) {
      return { balance: null, error: e.message };
    }
  }

  /**
   * Airtime top-up.
   * Uses recipient phone in international format without +.
   */
  async fulfill(order) {
    if (order.service_type !== 'airtime') {
      return { success: false, error: 'ReloadlyService only handles airtime in V1' };
    }

    // Resolve operator ID dynamically
    const op = await this.getOperatorByName(order.provider, 'MZ');
    if (!op) {
      return { success: false, error: `Operator not found on Reloadly: ${order.provider}` };
    }

    // Normalize phone: store as +258..., send as 258...
    let phone = String(order.customer_identifier).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '258' + phone.slice(1);
    if (!phone.startsWith('258')) phone = '258' + phone;

    const amount = Number(order.local_amount);
    if (!amount || amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    const body = {
      operatorId: op.operatorId || op.id,
      amount,
      useLocalAmount: true,
      customIdentifier: order.order_reference,
      recipientPhone: {
        countryCode: 'MZ',
        number: phone,
      },
    };

    try {
      const data = await this._request('POST', '/topups', body);
      return {
        success: true,
        transactionId: String(data.transactionId || data.id || ''),
        raw: data,
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        raw: e.data || null,
      };
    }
  }
}

module.exports = new ReloadlyService();
