

const DISCORD_API = 'https://discord.com/api';
const SCOPE = 'identify';

function config() {
  return {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.clientId && c.clientSecret && c.redirectUri);
}

function buildAuthorizeUrl(state) {
  const c = config();
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    state,
    prompt: 'consent',
  });
  return `${DISCORD_API}/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  const c = config();
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: c.redirectUri,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`No se pudo canjear el código de Discord (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo leer el perfil de Discord (${res.status}).`);
  const u = await res.json();

  const avatarUrl = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${(Number(u.id) >> 22) % 6}.png`;

  return {
    id: u.id,
    username: u.username,
    globalName: u.global_name || u.username,
    avatar: avatarUrl,
  };
}

module.exports = { isConfigured, buildAuthorizeUrl, exchangeCode, fetchUser, SCOPE };
