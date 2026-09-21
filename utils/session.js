const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || '';
if (!SECRET || SECRET.length < 16) {
  console.warn('⚠️  SESSION_SECRET vacío o muy corto. Pon un valor largo y aleatorio en .env; si no, las sesiones no son seguras.');
}

const SESSION_COOKIE = 'apply_session';
const STATE_COOKIE = 'apply_oauth_state';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payloadObj) {
  const body = b64url(JSON.stringify(payloadObj));
  const mac = crypto.createHmac('sha256', SECRET || 'insecure-dev-secret').update(body).digest();
  return `${body}.${b64url(mac)}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, macPart] = token.split('.');
  if (!body || !macPart) return null;
  const expected = crypto.createHmac('sha256', SECRET || 'insecure-dev-secret').update(body).digest();
  let given;
  try {
    given = fromB64url(macPart);
  } catch {
    return null;
  }
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(fromB64url(body).toString('utf8'));
    if (!data || typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function cookieOpts(extra = {}) {

  const secure = /^https:/i.test(process.env.OAUTH_REDIRECT_URI || process.env.PUBLIC_BASE_URL || '');
  return { httpOnly: true, sameSite: 'lax', secure, path: '/', ...extra };
}

function setSession(res, user) {
  const token = sign({ user, exp: Date.now() + MAX_AGE_MS });
  res.cookie(SESSION_COOKIE, token, cookieOpts({ maxAge: MAX_AGE_MS }));
}

function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOpts());
}

function readSession(req) {
  const raw = req.cookies?.[SESSION_COOKIE];
  const data = verify(raw);
  return data?.user || null;
}

function setOAuthState(res, state) {
  const token = sign({ state, exp: Date.now() + 1000 * 60 * 10 });
  res.cookie(STATE_COOKIE, token, cookieOpts({ maxAge: 1000 * 60 * 10 }));
}

function takeOAuthState(req, res) {
  const data = verify(req.cookies?.[STATE_COOKIE]);
  res.clearCookie(STATE_COOKIE, cookieOpts());
  return data?.state || null;
}

function attachUser(req, res, next) {
  req.user = readSession(req);
  next();
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicia sesión con Discord para continuar.' });
  next();
}

const TURNSTILE_COOKIE = 'apply_turnstile_ok';

function setTurnstileVerified(res) {
  const token = sign({ ok: true, exp: Date.now() + 1000 * 60 * 10 });
  res.cookie(TURNSTILE_COOKIE, token, cookieOpts({ maxAge: 1000 * 60 * 10 }));
}

function hasTurnstileVerified(req) {
  return !!verify(req.cookies?.[TURNSTILE_COOKIE])?.ok;
}

module.exports = {
  setSession,
  clearSession,
  readSession,
  setOAuthState,
  takeOAuthState,
  attachUser,
  requireUser,
  setTurnstileVerified,
  hasTurnstileVerified,
};
