const { test } = require('node:test');
const assert = require('node:assert');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_secret_that_is_long_enough_1234567890';
const session = require('../utils/session');

function fakeRes() {
  const cookies = {};
  return {
    cookies,
    cookie(name, value) { cookies[name] = value; },
  };
}

test('setTurnstileVerified + hasTurnstileVerified: recién puesta, cuenta como verificada', () => {
  const res = fakeRes();
  session.setTurnstileVerified(res);
  const req = { cookies: res.cookies };
  assert.strictEqual(session.hasTurnstileVerified(req), true);
});

test('hasTurnstileVerified: sin cookie, no está verificado', () => {
  assert.strictEqual(session.hasTurnstileVerified({ cookies: {} }), false);
});

test('hasTurnstileVerified: una cookie manipulada/inválida no cuenta', () => {
  const req = { cookies: { apply_turnstile_ok: 'esto-no-es-una-firma-valida' } };
  assert.strictEqual(session.hasTurnstileVerified(req), false);
});
