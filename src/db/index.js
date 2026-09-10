/**
 * Simple JSON file store for V1.
 * Atomic writes via temp file + rename.
 * Schema mirrors the planned SQLite tables (orders, providers, products).
 * Upgrade path: swap this module for better-sqlite3 without changing callers.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbPath = path.resolve(
  String(config.databaseUrl || './data/aircrypto.db').replace(/\.db$/, '.json')
);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const defaultData = {
  providers: [],
  products: [],
  orders: [],
  _seq: { providers: 0, products: 0, orders: 0 },
};

function load() {
  if (!fs.existsSync(dbPath)) {
    atomicWrite(dbPath, JSON.stringify(defaultData, null, 2));
    return JSON.parse(JSON.stringify(defaultData));
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function atomicWrite(filePath, content) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function save(data) {
  atomicWrite(dbPath, JSON.stringify(data, null, 2));
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
};

module.exports = db;
