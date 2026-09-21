const { extractPlatformInput } = require('./urlHelpers');
const { resolveChannel } = require('./youtube');
const { resolveUser: resolveTwitchUser } = require('./twitch');
const { resolveUser: resolveKickUser } = require('./kick');
const { resolveUser: resolveTiktokUser } = require('./tiktok');

async function verifyPlatformLink(platform, url) {
  const input = extractPlatformInput(url, platform);
  if (!input) return { verified: false };

  try {
    if (platform === 'youtube') {
      if (!process.env.YOUTUBE_API_KEY) return { verified: null, reason: 'YOUTUBE_API_KEY no configurada' };
      const channel = await resolveChannel(process.env.YOUTUBE_API_KEY, input);
      return channel ? { verified: true, displayName: channel.title } : { verified: false };
    }
    if (platform === 'twitch') {
      if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
        return { verified: null, reason: 'credenciales de Twitch no configuradas' };
      }
      const user = await resolveTwitchUser(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, input);
      return user ? { verified: true, displayName: user.displayName } : { verified: false };
    }

    if (platform === 'tiktok') {
      try {
        const profile = await resolveTiktokUser(input);
        return profile ? { verified: true, displayName: profile.displayName } : { verified: null, reason: 'No se pudo leer el perfil de TikTok ahora mismo' };
      } catch (err) {
        return { verified: null, reason: err.message || 'error consultando TikTok' };
      }
    }
    if (platform === 'kick') {
      if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET) {
        return { verified: null, reason: 'credenciales de Kick no configuradas' };
      }
      const channel = await resolveKickUser(process.env.KICK_CLIENT_ID, process.env.KICK_CLIENT_SECRET, input);
      return channel ? { verified: true, displayName: channel.displayName } : { verified: false };
    }
    return { verified: null, reason: 'plataforma desconocida' };
  } catch (err) {
    return { verified: null, reason: err.message || 'error de red' };
  }
}

module.exports = { verifyPlatformLink };
