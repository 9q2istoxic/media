const { test } = require('node:test');
const assert = require('node:assert');
const { verifyPlatformLink } = require('../utils/platformVerify');

test('TikTok sin resultado del scraper -> verified:null, nunca false', async () => {
  const result = await verifyPlatformLink('tiktok', 'https://tiktok.com/@estenoexistedeverdadxyz123');

  assert.strictEqual(result.verified, null);
});

test('Kick sin credenciales configuradas -> verified:null, no revienta', async () => {
  const prevId = process.env.KICK_CLIENT_ID;
  const prevSecret = process.env.KICK_CLIENT_SECRET;
  delete process.env.KICK_CLIENT_ID;
  delete process.env.KICK_CLIENT_SECRET;
  const result = await verifyPlatformLink('kick', 'https://kick.com/alguien');
  assert.strictEqual(result.verified, null);
  if (prevId) process.env.KICK_CLIENT_ID = prevId;
  if (prevSecret) process.env.KICK_CLIENT_SECRET = prevSecret;
});

test('YouTube sin API key configurada -> verified:null, no revienta', async () => {
  const prev = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  const result = await verifyPlatformLink('youtube', 'https://youtube.com/@alguien');
  assert.strictEqual(result.verified, null);
  if (prev) process.env.YOUTUBE_API_KEY = prev;
});

test('Twitch sin credenciales configuradas -> verified:null, no revienta', async () => {
  const prevId = process.env.TWITCH_CLIENT_ID;
  const prevSecret = process.env.TWITCH_CLIENT_SECRET;
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
  const result = await verifyPlatformLink('twitch', 'https://twitch.tv/alguien');
  assert.strictEqual(result.verified, null);
  if (prevId) process.env.TWITCH_CLIENT_ID = prevId;
  if (prevSecret) process.env.TWITCH_CLIENT_SECRET = prevSecret;
});

test('enlace vacío -> verified:false sin llamar a nada', async () => {
  const result = await verifyPlatformLink('youtube', '');
  assert.strictEqual(result.verified, false);
});
