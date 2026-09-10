const Order = require('../models/Order');
const reloadly = require('./providers/reloadly');
const config = require('../config');

/**
 * Attempt to fulfill an order after payment is confirmed.
 * Idempotent: if already completed, returns safely without calling provider again.
 */
async function fulfillOrder(orderId) {
  const order = Order.getById(orderId);
  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.fulfillment_status === 'completed') {
    return { success: true, alreadyCompleted: true, order };
  }

  if (order.payment_status !== 'confirmed') {
    return { success: false, error: 'Payment not confirmed', order };
  }

  // Mark as in-progress to reduce race windows
  Order.updateOrder(order.id, { fulfillment_status: 'processing' });

  let result;

  if (order.service_type === 'airtime') {
    result = await reloadly.fulfill(order);
  } else if (order.service_type === 'tv') {
    // TV not automated in V1
    result = {
      success: false,
      error: 'TV fulfillment is not automated in V1. Manual processing required.',
    };
  } else {
    result = { success: false, error: `Unknown service_type: ${order.service_type}` };
  }

  if (result.success) {
    const transitioned = Order.markFulfillmentCompleted(
      order.id,
      result.transactionId,
      result.raw
    );
    const updated = Order.getById(order.id);
    return {
      success: true,
      transitioned,
      order: updated,
      providerTransactionId: result.transactionId,
    };
  }

  Order.markFulfillmentFailed(order.id, result.error || 'Fulfillment failed');
  return {
    success: false,
    error: result.error,
    order: Order.getById(order.id),
    raw: result.raw,
  };
}

/**
 * Called from webhook when payment is confirmed.
 */
async function handlePaymentConfirmed(order) {
  if (order.fulfillment_status === 'completed') {
    return { alreadyDone: true };
  }
  return fulfillOrder(order.id);
}

module.exports = {
  fulfillOrder,
  handlePaymentConfirmed,
};
