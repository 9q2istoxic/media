const { test } = require('node:test');
const assert = require('node:assert');
const { detectPlatformFromUrl, extractPlatformInput } = require('../utils/urlHelpers');

test('detecta YouTube por dominio', () => {
  assert.strictEqual(detectPlatformFromUrl('https://youtube.com/@canal'), 'youtube');
  assert.strictEqual(detectPlatformFromUrl('https://youtu.be/abc123'), 'youtube');
});
test('detecta TikTok, Twitch y Kick por dominio', () => {
  assert.strictEqual(detectPlatformFromUrl('https://tiktok.com/@user'), 'tiktok');
  assert.strictEqual(detectPlatformFromUrl('https://twitch.tv/user'), 'twitch');
  assert.strictEqual(detectPlatformFromUrl('https://kick.com/user'), 'kick');
});
test('devuelve null si no reconoce el dominio', () => {
  assert.strictEqual(detectPlatformFromUrl('https://example.com/user'), null);
  assert.strictEqual(detectPlatformFromUrl(''), null);
});

test('extrae handle de YouTube con @', () => {
  assert.strictEqual(extractPlatformInput('https://youtube.com/@MiCanal', 'youtube'), '@MiCanal');
});
test('extrae id de YouTube con /channel/', () => {
  assert.strictEqual(extractPlatformInput('https://youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx', 'youtube'), 'UCxxxxxxxxxxxxxxxxxxxxxx');
});
test('extrae login de Twitch', () => {
  assert.strictEqual(extractPlatformInput('https://twitch.tv/miuser', 'twitch'), 'miuser');
});
test('extrae slug de Kick', () => {
  assert.strictEqual(extractPlatformInput('https://kick.com/miuser', 'kick'), 'miuser');
});
test('extrae handle de TikTok con @', () => {
  assert.strictEqual(extractPlatformInput('https://tiktok.com/@miuser', 'tiktok'), '@miuser');
});
test('URL inválida no rompe, devuelve el string tal cual', () => {
  assert.strictEqual(extractPlatformInput('no-es-una-url', 'twitch'), 'no-es-una-url');
});
