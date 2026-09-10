const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { init } = require('./db/init');

// Ensure schema exists
init();

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // allow inline for simple static frontend in V1
}));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '100kb' }));

// Global rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// API routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/admin', require('./routes/admin'));

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AirCrypto MZ',
    env: config.env,
    time: new Date().toISOString(),
  });
});

// Static frontend
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(config.port, () => {
  console.log(`AirCrypto MZ listening on http://localhost:${config.port}`);
  console.log(`Env: ${config.env} | Simulation: ${config.allowSimulation}`);
  console.log(`Enabled cryptos: ${config.enabledCryptos.join(', ')}`);
});
