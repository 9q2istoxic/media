const path = require('path');
const { readJSON } = require('./storage');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DEFAULTS = {
  notificationChannelId: null,
  logChannelId: null,
  adminRoleId: null,
  roles: {},
};

function getConfig() {
  return readJSON(CONFIG_PATH, DEFAULTS);
}

module.exports = { getConfig };
