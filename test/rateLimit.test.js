const { test } = require('node:test');
const assert = require('node:assert');
const { createRateLimiter, _resetAll } = require('../utils/rateLimit');

function fakeReqRes(key) {
  const req = { ip: key };
  let statusCode = 200;
  let body = null;
  const res = {
    set() { return res; },
    status(code) { statusCode = code; return res; },
    json(payload) { body = payload; return res; },
  };
  return { req, res, get statusCode() { return statusCode; }, get body() { return body; } };
}

test('permite peticiones por debajo del límite', () => {
  _resetAll();
  const limiter = createRateLimiter({ windowMs: 1000, max: 3, keyFn: (req) => req.ip });
  const { req, res } = fakeReqRes('1.2.3.4');
  let calledNext = 0;
  for (let i = 0; i < 3; i++) limiter(req, res, () => { calledNext++; });
  assert.strictEqual(calledNext, 3);
});

test('bloquea al superar el máximo dentro de la ventana', () => {
  _resetAll();
  const limiter = createRateLimiter({ windowMs: 10000, max: 2, keyFn: (req) => req.ip });
  const call = fakeReqRes('9.9.9.9');
  let nextCount = 0;
  limiter(call.req, call.res, () => nextCount++);
  limiter(call.req, call.res, () => nextCount++);
  limiter(call.req, call.res, () => nextCount++);
  assert.strictEqual(nextCount, 2);
  assert.strictEqual(call.statusCode, 429);
  assert.ok(call.body && call.body.error);
});

test('claves distintas no se pisan entre sí', () => {
  _resetAll();
  const limiter = createRateLimiter({ windowMs: 10000, max: 1, keyFn: (req) => req.ip });
  const a = fakeReqRes('1.1.1.1');
  const b = fakeReqRes('2.2.2.2');
  let nextCount = 0;
  limiter(a.req, a.res, () => nextCount++);
  limiter(b.req, b.res, () => nextCount++);
  assert.strictEqual(nextCount, 2);
  assert.notStrictEqual(a.statusCode, 429);
  assert.notStrictEqual(b.statusCode, 429);
});

test('sin keyFn válida (null), no limita', () => {
  _resetAll();
  const limiter = createRateLimiter({ windowMs: 10000, max: 1, keyFn: () => null });
  const { req, res } = fakeReqRes('x');
  let nextCount = 0;
  for (let i = 0; i < 5; i++) limiter(req, res, () => nextCount++);
  assert.strictEqual(nextCount, 5);
});
