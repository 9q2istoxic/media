const { test } = require('node:test');
const assert = require('node:assert');

function withMockedFetch(responses, fn) {
  const original = global.fetch;
  let call = 0;
  global.fetch = async () => {
    const r = responses[call++];
    if (!r) throw new Error('no mock response left for call ' + call);
    if (r.throws) throw new Error(r.throws);
    return { ok: r.ok !== false, status: r.status || 200, json: async () => r.json };
  };
  return fn().finally(() => { global.fetch = original; });
}

function freshModule() {
  delete require.cache[require.resolve('../utils/turnstile')];
  return require('../utils/turnstile');
}

test('isTurnstileEnabled es false sin las dos claves configuradas', () => {
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  const { isTurnstileEnabled } = freshModule();
  assert.strictEqual(isTurnstileEnabled(), false);

  process.env.TURNSTILE_SITE_KEY = 'site';
  assert.strictEqual(freshModule().isTurnstileEnabled(), false);
  delete process.env.TURNSTILE_SITE_KEY;
});

test('isTurnstileEnabled es true con ambas claves', () => {
  process.env.TURNSTILE_SITE_KEY = 'site';
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  assert.strictEqual(freshModule().isTurnstileEnabled(), true);
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
});

test('verifyTurnstileToken sin TURNSTILE_SECRET_KEY no verifica nada (false)', async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  const { verifyTurnstileToken } = freshModule();
  assert.strictEqual(await verifyTurnstileToken('algun-token', '1.2.3.4'), false);
});

test('verifyTurnstileToken sin token no verifica nada', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  const { verifyTurnstileToken } = freshModule();
  assert.strictEqual(await verifyTurnstileToken(null, '1.2.3.4'), false);
  delete process.env.TURNSTILE_SECRET_KEY;
});

test('verifyTurnstileToken true cuando Cloudflare confirma success:true', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  const { verifyTurnstileToken } = freshModule();
  await withMockedFetch([{ json: { success: true } }], async () => {
    assert.strictEqual(await verifyTurnstileToken('tok', '1.2.3.4'), true);
  });
  delete process.env.TURNSTILE_SECRET_KEY;
});

test('verifyTurnstileToken false cuando Cloudflare dice success:false', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  const { verifyTurnstileToken } = freshModule();
  await withMockedFetch([{ json: { success: false, 'error-codes': ['invalid-input-response'] } }], async () => {
    assert.strictEqual(await verifyTurnstileToken('tok-malo', '1.2.3.4'), false);
  });
  delete process.env.TURNSTILE_SECRET_KEY;
});

test('verifyTurnstileToken falla cerrado (false) si Cloudflare no responde', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  const { verifyTurnstileToken } = freshModule();
  await withMockedFetch([{ throws: 'network down' }], async () => {
    assert.strictEqual(await verifyTurnstileToken('tok', '1.2.3.4'), false);
  });
  delete process.env.TURNSTILE_SECRET_KEY;
});

test('verifyTurnstileToken falla cerrado (false) si Cloudflare responde con error HTTP', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  const { verifyTurnstileToken } = freshModule();
  await withMockedFetch([{ ok: false, status: 500, json: {} }], async () => {
    assert.strictEqual(await verifyTurnstileToken('tok', '1.2.3.4'), false);
  });
  delete process.env.TURNSTILE_SECRET_KEY;
});
