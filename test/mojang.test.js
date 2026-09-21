const { test } = require('node:test');
const assert = require('node:assert');
const { checkMinecraftUsername } = require('../utils/mojang');

test('rechaza formatos que Mojang nunca aceptaría, sin llamar a la red', async () => {
  const result = await checkMinecraftUsername('a b c!!');
  assert.strictEqual(result.verified, false);
});

test('rechaza nicks demasiado cortos o demasiado largos', async () => {
  assert.strictEqual((await checkMinecraftUsername('ab')).verified, false);
  assert.strictEqual((await checkMinecraftUsername('a'.repeat(17))).verified, false);
});

test('vacío o no-string se rechaza sin llamar a la red', async () => {
  assert.strictEqual((await checkMinecraftUsername('')).verified, false);
  assert.strictEqual((await checkMinecraftUsername(undefined)).verified, false);
});
