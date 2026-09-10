require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',

  databaseUrl: process.env.DATABASE_URL || './data/aircrypto.db',

  nowpayments: {
    apiKey: process.env.NOWPAYMENTS_API_KEY || '',
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || '',
    sandbox: process.env.NOWPAYMENTS_SANDBOX !== 'false',
    apiBase: process.env.NOWPAYMENTS_SANDBOX !== 'false'
      ? 'https://api-sandbox.nowpayments.io/v1'
      : 'https://api.nowpayments.io/v1',
  },

  reloadly: {
    clientId: process.env.RELOADLY_CLIENT_ID || '',
    clientSecret: process.env.RELOADLY_CLIENT_SECRET || '',
    sandbox: process.env.RELOADLY_SANDBOX !== 'false',
    authUrl: process.env.RELOADLY_SANDBOX !== 'false'
      ? 'https://auth.reloadly.com/oauth/token'
      : 'https://auth.reloadly.com/oauth/token',
    apiBase: process.env.RELOADLY_SANDBOX !== 'false'
      ? 'https://topups-sandbox.reloadly.com'
      : 'https://topups.reloadly.com',
  },

  pricing: {
    defaultMarginMzn: parseFloat(process.env.DEFAULT_MARGIN_MZN || '5'),
    defaultPaymentBufferMzn: parseFloat(process.env.DEFAULT_PAYMENT_BUFFER_MZN || '1'),
    defaultMarginPct: parseFloat(process.env.DEFAULT_MARGIN_PCT || '0'),
  },

  adminToken: (process.env.ADMIN_TOKEN || 'dev-admin-token-change-me').trim(),
  enabledCryptos: (process.env.ENABLED_CRYPTOS || 'BCH,USDT,BTC,LTC,ETH')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean),

  allowSimulation: process.env.ALLOW_SIMULATION === 'true' && (process.env.NODE_ENV || 'development') !== 'production',
};

// BCH must always be first
if (config.enabledCryptos[0] !== 'BCH') {
  config.enabledCryptos = ['BCH', ...config.enabledCryptos.filter((c) => c !== 'BCH')];
}

module.exports = config;
