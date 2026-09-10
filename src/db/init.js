const db = require('./index');

const DEFAULT_PROVIDERS = [
  { name: 'Vodacom', type: 'airtime', logo: '/assets/logos/vodacom.svg', integration: 'reloadly', active: 1, notes: 'Mozambique mobile. Prefixes 84/85', country: 'MZ' },
  { name: 'Movitel', type: 'airtime', logo: '/assets/logos/movitel.svg', integration: 'reloadly', active: 1, notes: 'Mozambique mobile. Prefixes 86/87', country: 'MZ' },
  { name: 'Tmcel', type: 'airtime', logo: '/assets/logos/tmcel.svg', integration: 'reloadly', active: 1, notes: 'mCel / Tmcel Mozambique. Prefixes 82/83', country: 'MZ' },
  { name: 'GOtv', type: 'tv', logo: '/assets/logos/gotv.svg', integration: 'manual', active: 0, notes: 'TV. Not automated in V1', country: 'MZ' },
  { name: 'DStv', type: 'tv', logo: '/assets/logos/dstv.svg', integration: 'manual', active: 0, notes: 'TV. Not automated in V1', country: 'MZ' },
  { name: 'ZAP', type: 'tv', logo: '/assets/logos/zap.svg', integration: 'manual', active: 0, notes: 'TV. Not automated in V1', country: 'MZ' },
];

function init() {
  const data = db._data();
  if (!data.providers) data.providers = [];
  if (!data.products) data.products = [];
  if (!data.orders) data.orders = [];
  if (!data._seq) data._seq = { providers: 0, products: 0, orders: 0 };

  // Auto-seed providers when empty (needed on Vercel cold starts)
  if (data.providers.length === 0) {
    for (const p of DEFAULT_PROVIDERS) {
      data._seq.providers += 1;
      data.providers.push({
        id: data._seq.providers,
        ...p,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  db._save();
  if (!db.isServerless) {
    console.log('Database ready at', db.path, db.isMemoryOnly() ? '(memory)' : '');
  }
}

if (require.main === module) {
  init();
}

module.exports = { init };
