let cachedToken = null;
let tokenExpiresAt = 0;

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twitch API ${res.status}: ${body}`);
  }
  return res.json();
}

async function getAppToken(clientId, clientSecret) {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
  const data = await getJSON(url, { method: 'POST' });
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function twitchHeaders(clientId, clientSecret) {
  const token = await getAppToken(clientId, clientSecret);
  return { 'Client-Id': clientId, Authorization: `Bearer ${token}` };
}

async function resolveUser(clientId, clientSecret, login) {
  const headers = await twitchHeaders(clientId, clientSecret);
  const data = await getJSON(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login.toLowerCase())}`,
    { headers }
  );
  const user = data.data?.[0];
  if (!user) return null;
  return { id: user.id, login: user.login, displayName: user.display_name, avatar: user.profile_image_url };
}

async function getLiveStream(clientId, clientSecret, userLogin) {
  const headers = await twitchHeaders(clientId, clientSecret);
  const data = await getJSON(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(userLogin.toLowerCase())}`,
    { headers }
  );
  const stream = data.data?.[0];
  if (!stream) return null;

  return {
    streamId: stream.id,
    title: stream.title,
    game: stream.game_name,
    viewers: stream.viewer_count,
    startedAt: stream.started_at,
    thumbnail: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
  };
}

module.exports = { resolveUser, getLiveStream };
