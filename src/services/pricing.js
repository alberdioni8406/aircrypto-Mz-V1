const config = require('../config');

/**
 * Backend pricing engine.
 * Never trust frontend amounts for final price.
 *
 * Conceptual:
 *   customer_price = provider_cost + margin + payment_buffer
 *
 * Margin is configurable (absolute MZN preferred).
 */
function calculateCustomerPrice(providerCostMzn, options = {}) {
  const cost = Number(providerCostMzn) || 0;
  const marginAbs = options.marginMzn != null
    ? Number(options.marginMzn)
    : config.pricing.defaultMarginMzn;
  const marginPct = options.marginPct != null
    ? Number(options.marginPct)
    : config.pricing.defaultMarginPct;
  const buffer = options.bufferMzn != null
    ? Number(options.bufferMzn)
    : config.pricing.defaultPaymentBufferMzn;

  const pctMargin = marginPct > 0 ? cost * marginPct : 0;
  const margin = marginAbs > 0 ? marginAbs : pctMargin;

  const total = Math.ceil((cost + margin + buffer) * 100) / 100; // round up to 2 decimals

  return {
    provider_cost: cost,
    aircrypto_margin: Math.round(margin * 100) / 100,
    payment_fee: Math.round(buffer * 100) / 100,
    total_price: total,
  };
}

/**
 * For airtime, provider cost is typically the face value (or slightly less with discounts).
 * Until live Reloadly product lookup is wired, we treat face value as provider cost base.
 */
function priceAirtime(faceValueMzn, options = {}) {
  return calculateCustomerPrice(faceValueMzn, options);
}

module.exports = {
  calculateCustomerPrice,
  priceAirtime,
};
