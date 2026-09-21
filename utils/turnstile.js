
async function verifyTurnstileToken(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;

    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function isTurnstileEnabled() {
  return !!(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

module.exports = { verifyTurnstileToken, isTurnstileEnabled };
