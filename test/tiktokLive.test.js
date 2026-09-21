const { test } = require('node:test');
const assert = require('node:assert');

function withMockedFetch(handlers, fn) {
  const original = global.fetch;
  global.fetch = async (url, opts) => handlers(String(url), opts);
  return fn().finally(() => { global.fetch = original; });
}

function htmlWithUniversalData(liveRoom) {
  const payload = { __DEFAULT_SCOPE__: { 'webapp.live-detail': { liveRoom } } };
  return `<html><head><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify(payload)}</script></head><body></body></html>`;
}

test('getLiveStatus devuelve null si no hay ningún room en el HTML', async () => {
  delete require.cache[require.resolve('../utils/tiktok')];
  const { getLiveStatus } = require('../utils/tiktok');

  await withMockedFetch(
    async () => ({ ok: true, text: async () => '<html><body>no live here</body></html>' }),
    async () => {
      const result = await getLiveStatus('alguien');
      assert.strictEqual(result, null);
    }
  );
});

test('getLiveStatus confirma con check_alive cuando el room_id es numérico', async () => {
  delete require.cache[require.resolve('../utils/tiktok')];
  const { getLiveStatus } = require('../utils/tiktok');
  let checkAliveCalled = false;

  await withMockedFetch(
    async (url) => {
      if (url.includes('/live') && !url.includes('check_alive')) {
        return { ok: true, text: async () => htmlWithUniversalData({ id: '123456789', status: 2, title: 'En directo' }) };
      }
      if (url.includes('check_alive')) {
        checkAliveCalled = true;
        return { ok: true, json: async () => ({ data: [{ room_id: '123456789', alive: true }] }) };
      }
      throw new Error('unexpected url ' + url);
    },
    async () => {
      const result = await getLiveStatus('alguien');
      assert.strictEqual(checkAliveCalled, true);
      assert.strictEqual(result.roomId, '123456789');
    }
  );
});

test('getLiveStatus descarta un directo "fantasma" si check_alive dice que ya no está activo', async () => {
  delete require.cache[require.resolve('../utils/tiktok')];
  const { getLiveStatus } = require('../utils/tiktok');

  await withMockedFetch(
    async (url) => {
      if (url.includes('check_alive')) {
        return { ok: true, json: async () => ({ data: [{ room_id: '999', alive: false }] }) };
      }
      return { ok: true, text: async () => htmlWithUniversalData({ id: '999', status: 2, title: 'Viejo directo' }) };
    },
    async () => {
      const result = await getLiveStatus('alguien');
      assert.strictEqual(result, null);
    }
  );
});

test('getLiveStatus NO descarta el directo si check_alive falla (prefiere el HTML antes que un fallo de red)', async () => {
  delete require.cache[require.resolve('../utils/tiktok')];
  const { getLiveStatus } = require('../utils/tiktok');

  await withMockedFetch(
    async (url) => {
      if (url.includes('check_alive')) return { ok: false, status: 500, text: async () => 'error' };
      return { ok: true, text: async () => htmlWithUniversalData({ id: '555', status: 2, title: 'Directo' }) };
    },
    async () => {
      const result = await getLiveStatus('alguien');
      assert.strictEqual(result.roomId, '555');
    }
  );
});
