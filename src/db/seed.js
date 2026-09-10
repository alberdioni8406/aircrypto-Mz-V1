const db = require('./index');
const { init } = require('./init');

init();

const providers = [
  { name: 'Vodacom', type: 'airtime', logo: '/assets/logos/vodacom.svg', integration: 'reloadly', active: 1, notes: 'Mozambique mobile. Prefixes 84/85' },
  { name: 'Movitel', type: 'airtime', logo: '/assets/logos/movitel.svg', integration: 'reloadly', active: 1, notes: 'Mozambique mobile. Prefixes 86/87' },
  { name: 'Tmcel', type: 'airtime', logo: '/assets/logos/tmcel.svg', integration: 'reloadly', active: 1, notes: 'mCel / Tmcel Mozambique. Prefixes 82/83' },
  { name: 'GOtv', type: 'tv', logo: '/assets/logos/gotv.svg', integration: 'manual', active: 0, notes: 'TV. Not automated in V1' },
  { name: 'DStv', type: 'tv', logo: '/assets/logos/dstv.svg', integration: 'manual', active: 0, notes: 'TV. Not automated in V1' },
  { name: 'ZAP', type: 'tv', logo: '/assets/logos/zap.svg', integration: 'manual', active: 0, notes: 'TV. Not automated in V1' },
];

const data = db._data();
for (const p of providers) {
  if (!data.providers.find((x) => x.name === p.name)) {
    data._seq.providers += 1;
    data.providers.push({
      id: data._seq.providers,
      ...p,
      country: 'MZ',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}
db._save();

console.log('Seeded providers:');
console.table(data.providers.map((p) => ({ id: p.id, name: p.name, type: p.type, active: p.active, integration: p.integration })));
