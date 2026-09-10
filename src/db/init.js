const db = require('./index');

function init() {
  // JSON store is schema-less; ensure structure exists
  const data = db._data();
  if (!data.providers) data.providers = [];
  if (!data.products) data.products = [];
  if (!data.orders) data.orders = [];
  if (!data._seq) data._seq = { providers: 0, products: 0, orders: 0 };
  db._save();
  console.log('Database ready at', db.path);
}

if (require.main === module) {
  init();
}

module.exports = { init };
