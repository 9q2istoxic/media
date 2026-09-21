const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'warnings.json');

function load() {
  return readJSON(DB_PATH, { warnings: [] });
}

function addWarning({ userId, staffId, reason }) {
  const db = load();
  const warning = {
    id: `warn_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    userId,
    staffId,
    reason,
    createdAt: new Date().toISOString(),
  };
  db.warnings.push(warning);
  writeJSON(DB_PATH, db);
  return warning;
}

function getWarningsFor(userId) {
  return load().warnings.filter((w) => w.userId === userId);
}

module.exports = { addWarning, getWarningsFor };
