const config = require('../config');

function adminAuth(req, res, next) {
  const raw =
    req.headers['x-admin-token'] ||
    req.query.token ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  const token = String(raw || '').trim();
  const expected = String(config.adminToken || '').trim();

  if (!token || !expected || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = adminAuth;
