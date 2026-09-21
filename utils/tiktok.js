

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`TikTok HTTP ${res.status} en ${url}`);
  return res.text();
}

function extractJsonById(html, scriptId) {
  const re = new RegExp(`<script id="${scriptId}"[^>]*>([\\s\\S]*?)</script>`);
  const match = html.match(re);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractUniversalData(html) {
  return extractJsonById(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__');
}

function extractSigiState(html) {
  return extractJsonById(html, 'SIGI_STATE');
}

function userFromUniversalData(data, fallbackHandle) {
  const scope = data?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
  const user = scope?.userInfo?.user;
  if (!user) return null;
  return {
    username: user.uniqueId || fallbackHandle,
    displayName: user.nickname || fallbackHandle,
    avatar: user.avatarThumb || user.avatarMedium,
    userId: user.id,
    secUid: user.secUid || null,
  };
}

function userFromSigiState(state, cleanHandle) {
  const users = state?.UserModule?.users || {};
  const user = users[cleanHandle.toLowerCase()] || Object.values(users)[0];
  if (!user) return null;
  return {
    username: user.uniqueId || cleanHandle,
    displayName: user.nickname || cleanHandle,
    avatar: user.avatarThumb,
    userId: user.id,
    secUid: user.secUid || null,
  };
}

async function resolveUser(username) {
  const clean = username.replace(/^@/, '');
  const html = await fetchHtml(`https://www.tiktok.com/@${clean}`);

  const universal = extractUniversalData(html);
  const fromUniversal = universal && userFromUniversalData(universal, clean);
  if (fromUniversal) return fromUniversal;

  const sigi = extractSigiState(html);
  const fromSigi = sigi && userFromSigiState(sigi, clean);
  if (fromSigi) return fromSigi;

  return null;
}

function itemFromApiResponse(item) {
  return {
    videoId: item.id,
    description: item.desc || '(sin descripción)',
    cover: item.video?.cover || item.video?.originCover || item.video?.dynamicCover,
    createdAt: Number(item.createTime) * 1000,
  };
}

async function fetchLatestViaItemListApi(secUid) {
  const url = `https://www.tiktok.com/api/post/item_list/?aid=1988&count=6&secUid=${encodeURIComponent(secUid)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const items = data?.itemList;
  if (!Array.isArray(items) || items.length === 0) return null;
  const latest = items.sort((a, b) => Number(b.createTime) - Number(a.createTime))[0];
  return itemFromApiResponse(latest);
}

async function getLatestVideo(username) {
  const clean = username.replace(/^@/, '');
  const html = await fetchHtml(`https://www.tiktok.com/@${clean}`);

  const sigi = extractSigiState(html);
  const items = Object.values(sigi?.ItemModule || {});
  if (items.length > 0) {
    const latest = items.sort((a, b) => Number(b.createTime) - Number(a.createTime))[0];
    return { ...itemFromApiResponse(latest), url: `https://www.tiktok.com/@${clean}/video/${latest.id}` };
  }

  const universal = extractUniversalData(html);
  const profile = (universal && userFromUniversalData(universal, clean)) || userFromSigiState(sigi, clean);
  if (!profile?.secUid) return null;

  try {
    const viaApi = await fetchLatestViaItemListApi(profile.secUid);
    if (!viaApi) return null;
    return { ...viaApi, url: `https://www.tiktok.com/@${clean}/video/${viaApi.videoId}` };
  } catch (err) {
    console.error('[tiktok] fetchLatestViaItemListApi falló:', err.message);
    return null;
  }
}

async function checkRoomAlive(roomId) {
  try {
    const url = `https://webcast.tiktok.com/webcast/room/check_alive/?aid=1988&room_ids=${encodeURIComponent(roomId)}&app_language=es`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const entry = data?.data?.[0];
    if (!entry) return null;
    return !!entry.alive;
  } catch {
    return null;
  }
}

async function getLiveStatus(username) {
  const clean = username.replace(/^@/, '');
  try {
    const html = await fetchHtml(`https://www.tiktok.com/@${clean}/live`);

    const universal = extractUniversalData(html);
    const liveScope =
      universal?.__DEFAULT_SCOPE__?.['webapp.live-detail'] || universal?.__DEFAULT_SCOPE__?.['webapp.live'];
    const liveRoomUniversal = liveScope?.liveRoom || liveScope?.roomInfo;

    let candidate = null;
    if (liveRoomUniversal && (liveRoomUniversal.status === 2 || liveRoomUniversal.id)) {
      candidate = {
        roomId: String(liveRoomUniversal.id || `${clean}-live`),
        title: liveRoomUniversal.title || `${clean} en directo`,
        cover: liveRoomUniversal.coverUrl || liveRoomUniversal.cover?.url_list?.[0],
        url: `https://www.tiktok.com/@${clean}/live`,
      };
    } else {

      const sigi = extractSigiState(html);
      const liveRoomSigi = sigi?.LiveRoom?.liveRoomUserInfo || sigi?.LiveRoom?.[Object.keys(sigi?.LiveRoom || {})[0]];
      const isLiveSigi = !!(liveRoomSigi && (liveRoomSigi.liveRoom?.status === 2 || liveRoomSigi.user));
      if (isLiveSigi) {
        candidate = {
          roomId: String(liveRoomSigi.liveRoom?.id || `${clean}-live`),
          title: liveRoomSigi.liveRoom?.title || `${clean} en directo`,
          cover: liveRoomSigi.liveRoom?.coverUrl || liveRoomSigi.user?.avatarThumb,
          url: `https://www.tiktok.com/@${clean}/live`,
        };
      }
    }

    if (!candidate) return null;

    if (/^\d+$/.test(candidate.roomId)) {
      const alive = await checkRoomAlive(candidate.roomId);
      if (alive === false) return null;
    }

    return candidate;
  } catch (err) {

    console.error('[tiktok] getLiveStatus falló:', err.message);
    return null;
  }
}

module.exports = {
  resolveUser,
  getLatestVideo,
  getLiveStatus,

  _internal: { extractUniversalData, extractSigiState, userFromUniversalData, userFromSigiState, checkRoomAlive },
};
