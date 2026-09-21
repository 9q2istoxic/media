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

test('checkIp sin IPHUB_API_KEY no consulta nada y no bloquea', async () => {
  delete process.env.IPHUB_API_KEY;
  delete require.cache[require.resolve('../utils/antivpn')];
  const { checkIp } = require('../utils/antivpn');
  const result = await checkIp('1.2.3.4');
  assert.deepStrictEqual(result, { checked: false });
});

test('checkIp detecta VPN/proxy cuando block=1', async () => {
  process.env.IPHUB_API_KEY = 'test-key';
  delete require.cache[require.resolve('../utils/antivpn')];
  const { checkIp } = require('../utils/antivpn');
  await withMockedFetch([{ json: { block: 1, blockReason: 'Hosting, proxy or bad IP' } }], async () => {
    const result = await checkIp('1.2.3.4');
    assert.strictEqual(result.checked, true);
    assert.strictEqual(result.isVpn, true);
  });
  delete process.env.IPHUB_API_KEY;
});

test('checkIp con block=0 (IP residencial normal) no marca VPN', async () => {
  process.env.IPHUB_API_KEY = 'test-key';
  delete require.cache[require.resolve('../utils/antivpn')];
  const { checkIp } = require('../utils/antivpn');
  await withMockedFetch([{ json: { block: 0 } }], async () => {
    const result = await checkIp('1.2.3.4');
    assert.strictEqual(result.checked, true);
    assert.strictEqual(result.isVpn, false);
  });
  delete process.env.IPHUB_API_KEY;
});

test('checkIp con block=2 (ambiguo/no residencial) NO bloquea, para no rechazar redes corporativas', async () => {
  process.env.IPHUB_API_KEY = 'test-key';
  delete require.cache[require.resolve('../utils/antivpn')];
  const { checkIp } = require('../utils/antivpn');
  await withMockedFetch([{ json: { block: 2 } }], async () => {
    const result = await checkIp('1.2.3.4');
    assert.strictEqual(result.isVpn, false);
  });
  delete process.env.IPHUB_API_KEY;
});

test('checkIp falla abierto si el servicio no responde (error de red)', async () => {
  process.env.IPHUB_API_KEY = 'test-key';
  delete require.cache[require.resolve('../utils/antivpn')];
  const { checkIp } = require('../utils/antivpn');
  await withMockedFetch([{ throws: 'network down' }], async () => {
    const result = await checkIp('1.2.3.4');
    assert.deepStrictEqual(result, { checked: false });
  });
  delete process.env.IPHUB_API_KEY;
});

test('checkIp falla abierto si el servicio responde con error HTTP', async () => {
  process.env.IPHUB_API_KEY = 'test-key';
  delete require.cache[require.resolve('../utils/antivpn')];
  const { checkIp } = require('../utils/antivpn');
  await withMockedFetch([{ ok: false, status: 500, json: {} }], async () => {
    const result = await checkIp('1.2.3.4');
    assert.deepStrictEqual(result, { checked: false });
  });
  delete process.env.IPHUB_API_KEY;
});

test('checkIp sin IP no consulta nada', async () => {
  process.env.IPHUB_API_KEY = 'test-key';
  delete require.cache[require.resolve('../utils/antivpn')];
  const { checkIp } = require('../utils/antivpn');
  const result = await checkIp(null);
  assert.deepStrictEqual(result, { checked: false });
  delete process.env.IPHUB_API_KEY;
});
