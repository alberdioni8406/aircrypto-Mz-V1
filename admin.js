const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const Order = require('../models/Order');
const reloadly = require('../services/providers/reloadly');
const nowpayments = require('../services/nowpayments');
const db = require('../db');
const config = require('../config');

const router = express.Router();
router.use(adminAuth);

router.get('/dashboard', async (req, res) => {
  const stats = Order.todayStats();
  const providers = db.prepare('SELECT id, name, type, active, integration, notes FROM providers').all();

  let reloadlyBalance = null;
  let reloadlyLive = false;
  try {
    reloadlyLive = await reloadly.isAvailable();
    if (reloadlyLive) {
      const bal = await reloadly.getBalance();
      reloadlyBalance = bal;
    }
  } catch (e) {
    reloadlyBalance = { error: e.message };
  }

  const npStatus = await nowpayments.getStatus();

  res.json({
    today: {
      orders: stats.total || 0,
      completed: stats.completed || 0,
      pending: stats.pending || 0,
      failed: stats.failed || 0,
      sales_mzn: Math.round((stats.sales || 0) * 100) / 100,
      gross_margin_mzn: Math.round((stats.gross_margin || 0) * 100) / 100,
    },
    providers: providers.map((p) => ({
      ...p,
      status: p.active
        ? p.integration === 'reloadly'
          ? reloadlyLive
            ? 'LIVE'
            : 'OFFLINE'
          : p.integration === 'manual'
            ? 'MANUAL'
            : 'UNKNOWN'
        : 'DISABLED',
    })),
    balances: {
      reloadly: reloadlyBalance,
      nowpayments: npStatus,
    },
    config: {
      enabledCryptos: config.enabledCryptos,
      sandbox: {
        reloadly: config.reloadly.sandbox,
        nowpayments: config.nowpayments.sandbox,
      },
    },
  });
});

router.get('/orders', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = parseInt(req.query.offset || '0', 10);
  const search = req.query.q || null;
  const orders = Order.listOrders({ limit, offset, search });
  res.json({
    orders: orders.map((o) => ({
      order_reference: o.order_reference,
      created_at: o.created_at,
      service_type: o.service_type,
      provider: o.provider,
      customer_identifier: o.customer_identifier,
      local_amount: o.local_amount,
      total_price: o.total_price,
      crypto_currency: o.crypto_currency,
      crypto_amount: o.crypto_amount,
      payment_status: o.payment_status,
      fulfillment_status: o.fulfillment_status,
      aircrypto_margin: o.aircrypto_margin,
      provider_transaction_id: o.provider_transaction_id,
      completed_at: o.completed_at,
    })),
  });
});

router.get('/orders/:ref', (req, res) => {
  const order = Order.getByReference(req.params.ref);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

module.exports = router;
