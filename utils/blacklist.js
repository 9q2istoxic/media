const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'blacklist.json');

function load() {
  const db = readJSON(DB_PATH, { entries: {} });
  db.entries ||= {};
  return db;
}

function isBlacklisted(discordId) {
  return !!load().entries[discordId];
}

function getEntry(discordId) {
  return load().entries[discordId] || null;
}

function addToBlacklist(discordId, staffId, reason, ip = null) {
  const db = load();
  db.entries[discordId] = { staffId, reason: reason || 'Sin motivo', addedAt: Date.now(), ip: ip || null };
  writeJSON(DB_PATH, db);
  return db.entries[discordId];
}

function removeFromBlacklist(discordId) {
  const db = load();
  const existed = !!db.entries[discordId];
  delete db.entries[discordId];
  writeJSON(DB_PATH, db);
  return existed;
}

function listBlacklist() {
  return load().entries;
}

function isIpBlacklisted(ip) {
  if (!ip) return false;
  return Object.values(load().entries).some((e) => e.ip && e.ip === ip);
}

module.exports = { isBlacklisted, getEntry, addToBlacklist, removeFromBlacklist, listBlacklist, isIpBlacklisted };
