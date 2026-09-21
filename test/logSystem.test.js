const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'data', 'logSettings.json');
const WARNINGS_PATH = path.join(__dirname, '..', 'data', 'warnings.json');

function cleanup() {
  [SETTINGS_PATH, WARNINGS_PATH].forEach((p) => { if (fs.existsSync(p)) fs.unlinkSync(p); });
  delete require.cache[require.resolve('../utils/logSettings')];
  delete require.cache[require.resolve('../utils/warnings')];
}

test('LOG_CATEGORIES tiene 20 categorías con ids únicos', () => {
  const { LOG_CATEGORIES } = require('../utils/logCategories');
  assert.strictEqual(LOG_CATEGORIES.length, 20);
  const ids = new Set(LOG_CATEGORIES.map((c) => c.id));
  assert.strictEqual(ids.size, 20);
});

test('findCategory encuentra una categoría real y devuelve null si no existe', () => {
  const { findCategory } = require('../utils/logCategories');
  assert.strictEqual(findCategory('bans').label, 'Baneos');
  assert.strictEqual(findCategory('esto-no-existe'), null);
});

test('todas las categorías tienen las 20 requeridas por el cliente', () => {
  const { LOG_CATEGORIES } = require('../utils/logCategories');
  const required = [
    'invites', 'voiceJoinLeave', 'voiceMove', 'channelCreateDelete', 'channelUpdate',
    'roleCreateDelete', 'roleUpdate', 'guildUpdate', 'memberJoin', 'memberLeave',
    'profileUpdate', 'memberRoleUpdate', 'messageEdit', 'messageDelete', 'messagePin',
    'purge', 'bans', 'kicks', 'timeouts', 'warns',
  ];
  const ids = LOG_CATEGORIES.map((c) => c.id);
  for (const r of required) assert.ok(ids.includes(r), `falta la categoría ${r}`);
});

test('setLogChannel guarda y getLogChannel lo recupera', () => {
  cleanup();
  const { getLogChannel, setLogChannel, getAllLogChannels } = require('../utils/logSettings');
  assert.strictEqual(getLogChannel('bans'), null);
  setLogChannel('bans', '123456789');
  assert.strictEqual(getLogChannel('bans'), '123456789');
  assert.deepStrictEqual(getAllLogChannels(), { bans: '123456789' });
  cleanup();
});

test('setLogChannel no pisa otras categorías ya configuradas', () => {
  cleanup();
  const { getLogChannel, setLogChannel } = require('../utils/logSettings');
  setLogChannel('bans', '111');
  setLogChannel('kicks', '222');
  assert.strictEqual(getLogChannel('bans'), '111');
  assert.strictEqual(getLogChannel('kicks'), '222');
  cleanup();
});

test('addWarning y getWarningsFor', () => {
  cleanup();
  const { addWarning, getWarningsFor } = require('../utils/warnings');
  assert.strictEqual(getWarningsFor('u1').length, 0);
  addWarning({ userId: 'u1', staffId: 's1', reason: 'spam' });
  addWarning({ userId: 'u1', staffId: 's1', reason: 'flood' });
  addWarning({ userId: 'u2', staffId: 's1', reason: 'otra cosa' });
  assert.strictEqual(getWarningsFor('u1').length, 2);
  assert.strictEqual(getWarningsFor('u2').length, 1);
  assert.strictEqual(getWarningsFor('u1')[0].reason, 'spam');
  cleanup();
});
