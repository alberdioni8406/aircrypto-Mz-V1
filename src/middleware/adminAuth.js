const config = require('../config');

function adminAuth(req, res, next) {
  const token =
    req.headers['x-admin-token'] ||
    req.query.token ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!token || token !== config.adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = adminAuth;
