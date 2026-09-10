/**
 * Simple JSON file store for V1.
 * - Local: ./data/aircrypto.json (atomic writes)
 * - Vercel/serverless: /tmp/aircrypto.json (writable; ephemeral per instance)
 * Falls back to in-memory if filesystem is unavailable.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

function resolveDbPath() {
  if (process.env.DATABASE_URL) {
    const p = String(process.env.DATABASE_URL).replace(/\.db$/, '.json');
    if (isServerless && !p.startsWith('/tmp')) {
      return path.join('/tmp', path.basename(p) || 'aircrypto.json');
    }
    return path.resolve(p);
  }
  if (isServerless) return '/tmp/aircrypto.json';
  return path.resolve('./data/aircrypto.json');
}

const dbPath = resolveDbPath();

const defaultData = {
  providers: [],
  products: [],
  orders: [],
  _seq: { providers: 0, products: 0, orders: 0 },
};

let memoryOnly = false;

function ensureDir(filePath) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

function atomicWrite(filePath, content) {
  const tmp = `\( {filePath}. \){process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function load() {
  if (memoryOnly) {
    return global.__aircryptoDb || JSON.parse(JSON.stringify(defaultData));
  }
  try {
    if (!fs.existsSync(dbPath)) {
      if (!ensureDir(dbPath)) {
        memoryOnly = true;
        global.__aircryptoDb = JSON.parse(JSON.stringify(defaultData));
        return global.__aircryptoDb;
      }
      try {
        atomicWrite(dbPath, JSON.stringify(defaultData, null, 2));
      } catch {
        memoryOnly = true;
        global.__aircryptoDb = JSON.parse(JSON.stringify(defaultData));
        return global.__aircryptoDb;
      }
      return JSON.parse(JSON.stringify(defaultData));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    memoryOnly = true;
    if (!global.__aircryptoDb) {
      global.__aircryptoDb = JSON.parse(JSON.stringify(defaultData));
    }
    return global.__aircryptoDb;
  }
}

function save(data) {
  if (memoryOnly) {
    global.__aircryptoDb = data;
    return;
  }
  try {
    ensureDir(dbPath);
    atomicWrite(dbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[db] write failed, switching to memory-only:', e.message);
    memoryOnly = true;
    global.__aircryptoDb = data;
  }
}

let cache = load();

const db = {
  _data: () => cache,
  _save: () => save(cache),
  _reload: () => {
    cache = load();
    return cache;
  },
  path: dbPath,
  isMemoryOnly: () => memoryOnly,
  isServerless,
};

module.exports = db;
