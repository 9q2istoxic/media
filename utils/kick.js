

const TOKEN_URL = 'https://id.kick.com/oauth/token';
const API_BASE = 'https://api.kick.com/public/v1';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Kick API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function getAppToken(clientId, clientSecret) {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const data = await getJSON(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function kickHeaders(clientId, clientSecret) {
  const token = await getAppToken(clientId, clientSecret);
  return { Authorization: `Bearer ${token}` };
}

async function resolveUser(clientId, clientSecret, slug) {
  const clean = slug.replace(/^@/, '').toLowerCase();
  const headers = await kickHeaders(clientId, clientSecret);
  const data = await getJSON(`${API_BASE}/channels?slug=${encodeURIComponent(clean)}`, { headers });
  const channel = data.data?.[0];
  if (!channel) return null;
  return {
    slug: channel.slug,
    displayName: channel.slug,
    broadcasterUserId: channel.broadcaster_user_id,
  };
}

async function getLiveStream(clientId, clientSecret, slug) {
  const clean = slug.replace(/^@/, '').toLowerCase();
  const headers = await kickHeaders(clientId, clientSecret);
  const data = await getJSON(`${API_BASE}/channels?slug=${encodeURIComponent(clean)}`, { headers });
  const channel = data.data?.[0];
  if (!channel || !channel.stream?.is_live) return null;

  return {

    streamId: channel.stream.start_time || `${clean}-live`,
    title: channel.stream_title || channel.stream?.session_title || 'Directo en Kick',
    game: channel.category?.name || null,
    viewers: channel.stream.viewer_count ?? null,
    startedAt: channel.stream.start_time || null,
    thumbnail: channel.banner_picture || null,
  };
}

module.exports = { resolveUser, getLiveStream };
