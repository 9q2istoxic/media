const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'data', 'logSettings.json');

function cleanup() {
  if (fs.existsSync(SETTINGS_PATH)) fs.unlinkSync(SETTINGS_PATH);
  delete require.cache[require.resolve('../utils/logSettings')];
  delete require.cache[require.resolve('../utils/auditLogger')];
}

test('sendLog no hace nada si la categoría no tiene canal configurado', async () => {
  cleanup();
  const { sendLog } = require('../utils/auditLogger');
  let fetchCalled = false;
  const fakeClient = { channels: { fetch: async () => { fetchCalled = true; return null; } } };
  await sendLog(fakeClient, 'bans', { embeds: [] });
  assert.strictEqual(fetchCalled, false);
  cleanup();
});

test('sendLog manda el payload al canal configurado', async () => {
  cleanup();
  const { setLogChannel } = require('../utils/logSettings');
  setLogChannel('bans', '999888777');
  const { sendLog } = require('../utils/auditLogger');

  let sentPayload = null;
  let fetchedId = null;
  const fakeChannel = { isTextBased: () => true, send: async (payload) => { sentPayload = payload; } };
  const fakeClient = { channels: { fetch: async (id) => { fetchedId = id; return fakeChannel; } } };

  await sendLog(fakeClient, 'bans', { embeds: ['fake-embed'] });
  assert.strictEqual(fetchedId, '999888777');
  assert.deepStrictEqual(sentPayload, { embeds: ['fake-embed'] });
  cleanup();
});

test('sendLog no revienta si el canal fetch falla', async () => {
  cleanup();
  const { setLogChannel } = require('../utils/logSettings');
  setLogChannel('bans', '999');
  const { sendLog } = require('../utils/auditLogger');
  const fakeClient = { channels: { fetch: async () => { throw new Error('no access'); } } };
  await assert.doesNotReject(() => sendLog(fakeClient, 'bans', { embeds: [] }));
  cleanup();
});

test('sendLog no envía si el canal no es de texto', async () => {
  cleanup();
  const { setLogChannel } = require('../utils/logSettings');
  setLogChannel('bans', '999');
  const { sendLog } = require('../utils/auditLogger');
  let sendCalled = false;
  const fakeChannel = { isTextBased: () => false, send: async () => { sendCalled = true; } };
  const fakeClient = { channels: { fetch: async () => fakeChannel } };
  await sendLog(fakeClient, 'bans', { embeds: [] });
  assert.strictEqual(sendCalled, false);
  cleanup();
});
