/**
 * Provider abstraction.
 * Concrete implementations: ReloadlyService, and future GotvService / DstvService / ZapService.
 */
class ProviderService {
  constructor(name) {
    this.name = name;
  }

  async isAvailable() {
    return false;
  }

  async getOperators(_country = 'MZ') {
    throw new Error('Not implemented');
  }

  async getProducts(_operatorId) {
    throw new Error('Not implemented');
  }

  /**
   * Fulfill a top-up / service.
   * Must be idempotent at the call-site (Order model already guards).
   * @returns {{ success: boolean, transactionId?: string, raw?: any, error?: string }}
   */
  async fulfill(_order) {
    throw new Error('Not implemented');
  }

  async getBalance() {
    return null;
  }
}

module.exports = ProviderService;
