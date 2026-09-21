

const MOJANG_API = 'https://api.mojang.com/users/profiles/minecraft';
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkMinecraftUsername(username) {
  const clean = String(username || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(clean)) {

    return { verified: false };
  }

  try {
    const res = await fetchWithTimeout(`${MOJANG_API}/${encodeURIComponent(clean)}`, TIMEOUT_MS);
    if (res.status === 200) {
      const data = await res.json();
      return { verified: true, uuid: data.id, name: data.name };
    }
    if (res.status === 404 || res.status === 204) {
      return { verified: false };
    }

    return { verified: null, reason: `Mojang respondió ${res.status}` };
  } catch (err) {
    return { verified: null, reason: err.message || 'timeout o red' };
  }
}

module.exports = { checkMinecraftUsername };
