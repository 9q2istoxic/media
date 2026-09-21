const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'blacklist.json');

function cleanup() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  delete require.cache[require.resolve('../utils/blacklist')];
}

test('isBlacklisted es false por defecto', () => {
  cleanup();
  const b = require('../utils/blacklist');
  assert.strictEqual(b.isBlacklisted('u1'), false);
  cleanup();
});

test('addToBlacklist marca a un usuario, removeFromBlacklist lo desmarca', () => {
  cleanup();
  const b = require('../utils/blacklist');
  b.addToBlacklist('u1', 'staff1', 'ban evasion');
  assert.strictEqual(b.isBlacklisted('u1'), true);
  assert.strictEqual(b.getEntry('u1').reason, 'ban evasion');
  const existed = b.removeFromBlacklist('u1');
  assert.strictEqual(existed, true);
  assert.strictEqual(b.isBlacklisted('u1'), false);
  cleanup();
});

test('removeFromBlacklist devuelve false si el usuario no estaba', () => {
  cleanup();
  const b = require('../utils/blacklist');
  assert.strictEqual(b.removeFromBlacklist('nadie'), false);
  cleanup();
});

test('addToBlacklist sin motivo cae en el texto por defecto', () => {
  cleanup();
  const b = require('../utils/blacklist');
  b.addToBlacklist('u2', 'staff1');
  assert.strictEqual(b.getEntry('u2').reason, 'Sin motivo');
  cleanup();
});

test('isIpBlacklisted detecta una cuenta nueva desde la misma IP que alguien ya blacklisteado', () => {
  cleanup();
  const b = require('../utils/blacklist');
  b.addToBlacklist('u1', 'staff1', 'evasión', '1.2.3.4');
  assert.strictEqual(b.isIpBlacklisted('1.2.3.4'), true);
  assert.strictEqual(b.isIpBlacklisted('9.9.9.9'), false);
  cleanup();
});

test('isIpBlacklisted es false si nunca se guardó una IP (sin solicitudes previas)', () => {
  cleanup();
  const b = require('../utils/blacklist');
  b.addToBlacklist('u1', 'staff1', 'motivo');
  assert.strictEqual(b.isIpBlacklisted(null), false);
  assert.strictEqual(b.isIpBlacklisted('1.2.3.4'), false);
  cleanup();
});

test('listBlacklist devuelve todas las entradas sin afectarse entre sí', () => {
  cleanup();
  const b = require('../utils/blacklist');
  b.addToBlacklist('u1', 's1', 'a');
  b.addToBlacklist('u2', 's1', 'b');
  const all = b.listBlacklist();
  assert.strictEqual(Object.keys(all).length, 2);
  b.removeFromBlacklist('u1');
  assert.strictEqual(Object.keys(b.listBlacklist()).length, 1);
  cleanup();
});
