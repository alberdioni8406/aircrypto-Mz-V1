const express = require('express');
const rateLimit = require('express-rate-limit');
const Order = require('../models/Order');
const { priceAirtime } = require('../services/pricing');
const nowpayments = require('../services/nowpayments');
const { fulfillOrder } = require('../services/fulfillment');
const { isValidMzPhone, normalizeMzPhone, isValidAmount } = require('../utils/validation');
const config = require('../config');
const QRCode = require('qrcode');

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many orders. Try again later.' },
});

/**
 * GET /api/config — public non-secret config for frontend
 */
router.get('/config', (req, res) => {
  res.json({
    enabledCryptos: config.enabledCryptos,
    currency: 'MZN',
    allowSimulation: config.allowSimulation,
    providers: {
      airtime: ['Vodacom', 'Movitel', 'Tmcel'],
      tv: [], // disabled in V1 until real integration
    },
  });
});

/**
 * POST /api/orders
 * Create order + payment. Frontend only sends service details; backend prices & creates payment.
 */
router.post('/', createLimiter, async (req, res) => {
  try {
    const {
      service_type = 'airtime',
      provider,
      customer_identifier,
      local_amount,
      crypto_currency = 'BCH',
      product,
    } = req.body || {};

    if (!provider || !customer_identifier || local_amount == null) {
      return res.status(400).json({ error: 'provider, customer_identifier and local_amount are required' });
    }

    const coin = String(crypto_currency).toUpperCase();
    if (!config.enabledCryptos.includes(coin)) {
      return res.status(400).json({ error: `Unsupported crypto: ${coin}` });
    }

    if (service_type === 'airtime') {
      if (!isValidMzPhone(customer_identifier)) {
        return res.status(400).json({ error: 'Invalid Mozambique mobile number' });
      }
      if (!isValidAmount(local_amount, { min: 10, max: 5000 })) {
        return res.status(400).json({ error: 'Amount must be between 10 and 5000 MZN' });
      }
    } else if (service_type === 'tv') {
      return res.status(503).json({
        error: 'TV services are not yet automated. Coming soon.',
        status: 'unavailable',
      });
    } else {
      return res.status(400).json({ error: 'Unsupported service_type' });
    }

    const phone = normalizeMzPhone(customer_identifier);
    const pricing = priceAirtime(Number(local_amount));

    // Create order first (pending)
    const order = Order.createOrder({
      service_type,
      provider: String(provider),
      product: product || `${local_amount} MZN`,
      customer_identifier: phone,
      local_amount: Number(local_amount),
      currency: 'MZN',
      crypto_currency: coin,
      provider_cost: pricing.provider_cost,
      aircrypto_margin: pricing.aircrypto_margin,
      payment_fee: pricing.payment_fee,
      total_price: pricing.total_price,
      payment_status: 'pending',
      fulfillment_status: 'pending',
    });

    // Create NOWPayments payment
    let payment;
    try {
      payment = await nowpayments.createPayment({
        priceAmount: pricing.total_price,
        priceCurrency: 'mzn',
        payCurrency: coin,
        orderId: order.order_reference,
        orderDescription: `AirCrypto ${provider} ${local_amount} MZN → ${phone}`,
      });
    } catch (e) {
      Order.updateOrder(order.id, {
        payment_status: 'failed',
        error_message: e.message,
      });
      return res.status(502).json({
        error: 'Payment provider error',
        detail: config.isDev ? e.message : undefined,
      });
    }

    const expiresAt = payment.expirationEstimateDate || null;
    Order.updateOrder(order.id, {
      crypto_amount: payment.payAmount,
      payment_transaction_id: payment.paymentId,
      payment_address: payment.payAddress,
      payment_extra: {
        network: payment.network,
        price_amount: payment.priceAmount,
        price_currency: payment.priceCurrency,
        raw: payment.raw,
      },
      expires_at: expiresAt,
    });

    // Generate QR (payment URI preferred when available)
    let qrDataUrl = null;
    try {
      const qrPayload = payment.payAddress; // simple address; can enhance with BIP21 later
      qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (e) {
      console.warn('QR generation failed', e.message);
    }

    const updated = Order.getById(order.id);

    res.status(201).json({
      order_reference: updated.order_reference,
      service_type: updated.service_type,
      provider: updated.provider,
      customer_identifier: updated.customer_identifier,
      local_amount: updated.local_amount,
      total_price: updated.total_price,
      currency: updated.currency,
      crypto_currency: updated.crypto_currency,
      crypto_amount: updated.crypto_amount,
      payment_address: updated.payment_address,
      payment_id: updated.payment_transaction_id,
      expires_at: updated.expires_at,
      qr_data_url: qrDataUrl,
      payment_status: updated.payment_status,
      fulfillment_status: updated.fulfillment_status,
    });
  } catch (err) {
    console.error('Create order error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/orders/:ref
 */
router.get('/:ref', (req, res) => {
  const order = Order.getByReference(req.params.ref);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Public safe fields only
  res.json({
    order_reference: order.order_reference,
    service_type: order.service_type,
    provider: order.provider,
    product: order.product,
    customer_identifier: order.customer_identifier,
    local_amount: order.local_amount,
    total_price: order.total_price,
    currency: order.currency,
    crypto_currency: order.crypto_currency,
    crypto_amount: order.crypto_amount,
    payment_address: order.payment_address,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    provider_transaction_id: order.provider_transaction_id,
    created_at: order.created_at,
    completed_at: order.completed_at,
    expires_at: order.expires_at,
    error_message: order.fulfillment_status === 'failed' ? 'Service delivery failed — support will contact you' : undefined,
  });
});

/**
 * POST /api/orders/:ref/simulate-payment
 * Dev-only. Never available in production.
 */
router.post('/:ref/simulate-payment', async (req, res) => {
  if (!config.allowSimulation) {
    return res.status(403).json({ error: 'Simulation disabled' });
  }
  const order = Order.getByReference(req.params.ref);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.payment_status === 'confirmed' && order.fulfillment_status === 'completed') {
    return res.json({ ok: true, alreadyCompleted: true, order: publicOrder(order) });
  }

  Order.updateOrder(order.id, { payment_status: 'confirmed' });
  const result = await fulfillOrder(order.id);
  const updated = Order.getById(order.id);
  res.json({
    ok: result.success,
    alreadyCompleted: result.alreadyCompleted || false,
    error: result.error,
    order: publicOrder(updated),
  });
});

function publicOrder(order) {
  return {
    order_reference: order.order_reference,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    provider_transaction_id: order.provider_transaction_id,
    completed_at: order.completed_at,
  };
}

module.exports = router;
