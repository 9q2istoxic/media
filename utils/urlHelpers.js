function sanitize(value, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

function detectPlatformFromUrl(rawUrl) {
  const clean = sanitize(rawUrl).toLowerCase();
  if (!clean) return null;
  if (clean.includes('tiktok.com')) return 'tiktok';
  if (clean.includes('twitch.tv')) return 'twitch';
  if (clean.includes('kick.com')) return 'kick';
  if (clean.includes('youtube.com') || clean.includes('youtu.be')) return 'youtube';
  return null;
}

function extractPlatformInput(rawUrl, platform) {
  const clean = sanitize(rawUrl);
  if (!clean) return '';
  try {
    const url = new URL(clean);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/^\/+|\/+$/g, '');
    if (platform === 'youtube') {
      if (pathname.startsWith('@')) return `@${pathname.slice(1).split('/')[0]}`;
      if (hostname.includes('youtu.be')) return pathname;
      const channelMatch = pathname.match(/^(?:channel|c|user)\/([^/?#]+)/i);
      if (channelMatch) return channelMatch[1];
      const handleMatch = pathname.match(/^@([^/?#]+)/);
      if (handleMatch) return `@${handleMatch[1]}`;
      if (url.searchParams.get('channel_id')) return url.searchParams.get('channel_id');
      return pathname || clean;
    }
    if (platform === 'twitch') return pathname.split('/')[0] || clean;
    if (platform === 'kick') return pathname.split('/')[0] || clean;
    if (platform === 'tiktok') {
      const m = pathname.match(/^@([^/?#]+)/);
      if (m) return `@${m[1]}`;
      return pathname.split('/')[0] || clean;
    }
  } catch {}
  return clean;
}

module.exports = { detectPlatformFromUrl, extractPlatformInput };
