const { test } = require('node:test');
const assert = require('node:assert');

function withMockedFetch(responses, fn) {
  const original = global.fetch;
  let call = 0;
  global.fetch = async (url, opts) => {
    const r = responses[call++];
    if (!r) throw new Error('no mock response left for call ' + call);
    if (r.captureBody) r.captureBody(opts?.body);
    if (r.captureUrl) r.captureUrl(url);
    return {
      ok: r.ok !== false,
      status: r.status || 200,
      json: async () => r.json,
      text: async () => r.text || '',
    };
  };
  return fn().finally(() => { global.fetch = original; });
}

test('getAppToken pide client_credentials a id.kick.com y cachea el token', async () => {
  delete require.cache[require.resolve('../utils/kick')];
  const { resolveUser } = require('../utils/kick');
  let tokenUrl = null;
  let channelUrl = null;

  await withMockedFetch(
    [
      { json: { access_token: 'tok123', expires_in: 3600 }, captureUrl: (u) => { tokenUrl = u; } },
      { json: { data: [{ slug: 'xqc', broadcaster_user_id: 1, stream: { is_live: true } }] }, captureUrl: (u) => { channelUrl = u; } },
    ],
    async () => {
      const user = await resolveUser('cid', 'csecret', 'xqc');
      assert.strictEqual(user.slug, 'xqc');
    }
  );

  assert.strictEqual(tokenUrl, 'https://id.kick.com/oauth/token');
  assert.match(channelUrl, /^https:\/\/api\.kick\.com\/public\/v1\/channels\?slug=xqc$/);
});

test('resolveUser devuelve null si el canal no existe', async () => {
  delete require.cache[require.resolve('../utils/kick')];
  const { resolveUser } = require('../utils/kick');

  await withMockedFetch(
    [
      { json: { access_token: 'tok123', expires_in: 3600 } },
      { json: { data: [] } },
    ],
    async () => {
      const user = await resolveUser('cid', 'csecret', 'noexiste');
      assert.strictEqual(user, null);
    }
  );
});

test('getLiveStream devuelve null si el canal no está en directo', async () => {
  delete require.cache[require.resolve('../utils/kick')];
  const { getLiveStream } = require('../utils/kick');

  await withMockedFetch(
    [
      { json: { access_token: 'tok123', expires_in: 3600 } },
      { json: { data: [{ slug: 'x', stream: { is_live: false } }] } },
    ],
    async () => {
      const stream = await getLiveStream('cid', 'csecret', 'x');
      assert.strictEqual(stream, null);
    }
  );
});

test('getLiveStream devuelve datos del directo cuando is_live es true', async () => {
  delete require.cache[require.resolve('../utils/kick')];
  const { getLiveStream } = require('../utils/kick');

  await withMockedFetch(
    [
      { json: { access_token: 'tok123', expires_in: 3600 } },
      {
        json: {
          data: [{
            slug: 'x',
            stream_title: 'Mi directo',
            stream: { is_live: true, viewer_count: 42, start_time: '2026-01-01T00:00:00Z' },
          }],
        },
      },
    ],
    async () => {
      const stream = await getLiveStream('cid', 'csecret', 'x');
      assert.strictEqual(stream.title, 'Mi directo');
      assert.strictEqual(stream.viewers, 42);
    }
  );
});

test('token endpoint que falla lanza un error legible', async () => {
  delete require.cache[require.resolve('../utils/kick')];
  const { resolveUser } = require('../utils/kick');

  await assert.rejects(
    () => withMockedFetch([{ ok: false, status: 401, text: 'invalid_client' }], () => resolveUser('bad', 'bad', 'x')),
    /Kick API 401/
  );
});
