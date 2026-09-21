const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'applications.json');

function load() {
  return readJSON(DB_PATH, { applications: [] });
}

function save(db) {
  writeJSON(DB_PATH, db);
}

function normalize(db) {
  if (!db || typeof db !== 'object') return { applications: [] };
  if (!Array.isArray(db.applications)) db.applications = [];
  return db;
}

function listAll() {
  return normalize(load()).applications;
}

function makeId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'APP-';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function createApplication(data) {
  const db = normalize(load());
  const application = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reason: null,
    messageId: null,
    channelId: null,
    ...data,
  };
  db.applications.unshift(application);
  save(db);
  return application;
}

function updateApplication(id, patch) {
  const db = normalize(load());
  const item = db.applications.find((a) => a.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  save(db);
  return item;
}

function getApplication(id) {
  const db = normalize(load());
  return db.applications.find((a) => a.id === id) || null;
}

function getPendingApplicationByDiscordId(discordId) {
  const db = normalize(load());
  return db.applications.find(
    (a) => a.status === 'pending' && String(a.discordId) === String(discordId)
  ) || null;
}

function getApplicationsByDiscordId(discordId) {
  const db = normalize(load());
  return db.applications
    .filter((a) => String(a.discordId) === String(discordId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  listAll,
  createApplication,
  updateApplication,
  getApplication,
  getPendingApplicationByDiscordId,
  getApplicationsByDiscordId,
};
