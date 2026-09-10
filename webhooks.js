const express = require('express');
const Order = require('../models/Order');
const nowpayments = require('../services/nowpayments');
const { handlePaymentConfirmed } = require('../services/fulfillment');
const config = require('../config');

const router = express.Router();

/**
 * NOWPayments IPN
 * Must receive raw body for signature verification in some setups;
 * we parse JSON and re-verify with sorted keys as per NOWPayments docs.
 */
router.post('/nowpayments', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const signature = req.headers['x-nowpayments-sig'];
    const body = req.body;

    if (!nowpayments.verifyIpnSignature(body, signature)) {
      console.warn('[IPN] Invalid signature');
      if (!config.isDev) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const paymentId = String(body.payment_id || body.id || '');
    const orderId = body.order_id;
    const npStatus = body.payment_status;

    console.log(`[IPN] payment_id=${paymentId} order_id=${orderId} status=${npStatus}`);

    let order = null;
    if (orderId) order = Order.getByReference(orderId);
    if (!order && paymentId) order = Order.getByPaymentTxId(paymentId);

    if (!order) {
      console.warn('[IPN] Order not found', { paymentId, orderId });
      // Still 200 so NOWPayments does not retry forever for unknown orders
      return res.status(200).json({ ok: true, note: 'order not found' });
    }

    const mapped = nowpayments.mapStatus(npStatus);

    if (mapped === 'confirmed') {
      if (order.payment_status !== 'confirmed') {
        Order.updateOrder(order.id, { payment_status: 'confirmed' });
      }
      // Fulfill (idempotent)
      const result = await handlePaymentConfirmed(Order.getById(order.id));
      console.log('[IPN] Fulfillment result', {
        ref: order.order_reference,
        success: result.success,
        already: result.alreadyCompleted || result.alreadyDone,
        error: result.error,
      });
    } else if (mapped === 'expired' || mapped === 'failed') {
      if (order.payment_status === 'pending') {
        Order.updateOrder(order.id, {
          payment_status: mapped,
          error_message: `Payment ${mapped}`,
        });
      }
    } else {
      // still pending / confirming
      if (order.payment_status === 'pending') {
        Order.updateOrder(order.id, { payment_status: 'pending' });
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[IPN] Error', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
