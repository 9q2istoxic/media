const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'accounts.json');

function load() {
  return readJSON(DB_PATH, { accounts: {} });
}

function save(db) {
  writeJSON(DB_PATH, db);
}

function normalize(db) {
  if (!db || typeof db !== 'object') return { accounts: {} };
  if (!db.accounts || typeof db.accounts !== 'object') db.accounts = {};
  return db;
}

function upsertAccount(user) {
  const db = normalize(load());
  const id = String(user.id);
  const existing = db.accounts[id];
  const now = new Date().toISOString();

  db.accounts[id] = {
    id,
    username: user.username,
    globalName: user.globalName || user.username,
    avatar: user.avatar,
    firstLoginAt: existing?.firstLoginAt || now,
    lastLoginAt: now,
    loginCount: (existing?.loginCount || 0) + 1,
  };
  save(db);
  return db.accounts[id];
}

function getAccount(discordId) {
  const db = normalize(load());
  return db.accounts[String(discordId)] || null;
}

module.exports = { upsertAccount, getAccount };
