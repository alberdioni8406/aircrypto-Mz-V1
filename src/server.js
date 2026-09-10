const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { init } = require('./db/init');

// Ensure schema + providers exist (safe on Vercel /tmp or memory)
try {
  init();
} catch (e) {
  console.warn('[init] non-fatal:', e.message);
}

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '100kb' }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/orders', require('./routes/orders'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AirCrypto MZ',
    env: config.env,
    vercel: !!process.env.VERCEL,
    time: new Date().toISOString(),
  });
});

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Export for Vercel serverless — do NOT call listen() on Vercel
module.exports = app;

// Local / traditional host only
if (require.main === module && !process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`AirCrypto MZ listening on http://localhost:${config.port}`);
    console.log(`Env: ${config.env} | Simulation: ${config.allowSimulation}`);
    console.log(`Enabled cryptos: ${config.enabledCryptos.join(', ')}`);
  });
}
