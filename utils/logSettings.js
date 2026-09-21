const path = require('path');
const { readJSON, writeJSON } = require('./storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'logSettings.json');

function load() {
  return readJSON(DB_PATH, { channels: {} });
}

function getLogChannel(categoryId) {
  return load().channels[categoryId] || null;
}

function setLogChannel(categoryId, channelId) {
  const db = load();
  db.channels[categoryId] = channelId;
  writeJSON(DB_PATH, db);
  return db;
}

function getAllLogChannels() {
  return load().channels;
}

module.exports = { getLogChannel, setLogChannel, getAllLogChannels };
