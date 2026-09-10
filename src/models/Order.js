const db = require('../db');
const { customAlphabet } = require('nanoid');

const generateRef = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

function now() {
  return new Date().toISOString();
}

function createOrder(data) {
  const store = db._data();
  store._seq.orders += 1;
  const id = store._seq.orders;
  const order_reference = `AC-${generateRef()}`;
  const order = {
    id,
    order_reference,
    service_type: data.service_type,
    provider: data.provider,
    product: data.product || null,
    customer_identifier: data.customer_identifier,
    local_amount: data.local_amount,
    currency: data.currency || 'MZN',
    crypto_currency: data.crypto_currency,
    crypto_amount: data.crypto_amount || null,
    provider_cost: data.provider_cost || null,
    aircrypto_margin: data.aircrypto_margin || null,
    payment_fee: data.payment_fee || null,
    total_price: data.total_price,
    payment_status: data.payment_status || 'pending',
    fulfillment_status: data.fulfillment_status || 'pending',
    payment_provider: data.payment_provider || 'nowpayments',
    payment_transaction_id: data.payment_transaction_id || null,
    payment_address: data.payment_address || null,
    payment_extra: data.payment_extra || null,
    provider_transaction_id: null,
    provider_response: null,
    error_message: null,
    created_at: now(),
    updated_at: now(),
    completed_at: null,
    expires_at: data.expires_at || null,
  };
  store.orders.push(order);
  db._save();
  return { ...order };
}

function getById(id) {
  return db._data().orders.find((o) => o.id === id) || null;
}

function getByReference(ref) {
  return db._data().orders.find((o) => o.order_reference === ref) || null;
}

function getByPaymentTxId(txId) {
  return db._data().orders.find((o) => o.payment_transaction_id === String(txId)) || null;
}

function updateOrder(id, fields) {
  const store = db._data();
  const order = store.orders.find((o) => o.id === id);
  if (!order) return null;
  const allowed = [
    'crypto_amount', 'provider_cost', 'aircrypto_margin', 'payment_fee', 'total_price',
    'payment_status', 'fulfillment_status', 'payment_transaction_id', 'payment_address',
    'payment_extra', 'provider_transaction_id', 'provider_response', 'error_message',
    'completed_at', 'expires_at',
  ];
  for (const key of allowed) {
    if (fields[key] !== undefined) order[key] = fields[key];
  }
  order.updated_at = now();
  db._save();
  return { ...order };
}

function markFulfillmentCompleted(id, providerTxId, providerResponse) {
  const store = db._data();
  const order = store.orders.find((o) => o.id === id);
  if (!order || order.fulfillment_status === 'completed') return false;
  order.fulfillment_status = 'completed';
  order.provider_transaction_id = providerTxId || null;
  order.provider_response = providerResponse || null;
  order.completed_at = now();
  order.updated_at = now();
  db._save();
  return true;
}

function markFulfillmentFailed(id, errorMessage) {
  const store = db._data();
  const order = store.orders.find((o) => o.id === id);
  if (!order || ['completed', 'failed'].includes(order.fulfillment_status)) return getById(id);
  order.fulfillment_status = 'failed';
  order.error_message = errorMessage;
  order.updated_at = now();
  db._save();
  return { ...order };
}

function listOrders({ limit = 50, offset = 0, search = null } = {}) {
  let rows = [...db._data().orders].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (o) =>
        (o.order_reference || '').toLowerCase().includes(q) ||
        (o.customer_identifier || '').toLowerCase().includes(q)
    );
  }
  return rows.slice(offset, offset + limit);
}

function todayStats() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db._data().orders.filter((o) => (o.created_at || '').startsWith(today));
  return {
    total: rows.length,
    completed: rows.filter((o) => o.fulfillment_status === 'completed').length,
    pending: rows.filter((o) => o.payment_status === 'pending' || o.fulfillment_status === 'pending').length,
    failed: rows.filter((o) => o.payment_status === 'failed' || o.fulfillment_status === 'failed').length,
    sales: rows.filter((o) => o.fulfillment_status === 'completed').reduce((s, o) => s + (o.total_price || 0), 0),
    gross_margin: rows.filter((o) => o.fulfillment_status === 'completed').reduce((s, o) => s + (o.aircrypto_margin || 0), 0),
  };
}

module.exports = {
  createOrder,
  getById,
  getByReference,
  getByPaymentTxId,
  updateOrder,
  markFulfillmentCompleted,
  markFulfillmentFailed,
  listOrders,
  todayStats,
};
