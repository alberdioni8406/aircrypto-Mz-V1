/**
 * Vercel serverless entry.
 * Re-exports the Express app so Vercel can invoke it as a function.
 */
module.exports = require('../src/server');
