

const buckets = new Map();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const CLEANUP_MAX_AGE_MS = 60 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < CLEANUP_MAX_AGE_MS);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

function createRateLimiter({ windowMs, max, keyFn, message }) {
  return function rateLimitMiddleware(req, res, next) {
    const key = keyFn(req);
    if (!key) return next();

    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

    if (hits.length >= max) {
      const retryAfterMs = windowMs - (now - hits[0]);
      res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      return res.status(429).json({
        error: message || 'Demasiados intentos. Espera un poco antes de volver a intentarlo.',
      });
    }

    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

function _resetAll() {
  buckets.clear();
}

module.exports = { createRateLimiter, _resetAll };
