const API = 'https://www.googleapis.com/youtube/v3';

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube API ${res.status}: ${body}`);
  }
  return res.json();
}

async function resolveChannel(apiKey, input) {
  const raw = input.trim();
  let url;

  if (/^UC[\w-]{22}$/.test(raw)) {
    url = `${API}/channels?part=snippet,contentDetails&id=${raw}&key=${apiKey}`;
  } else {
    const handle = raw.startsWith('@') ? raw.slice(1) : raw;
    url = `${API}/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
  }

  const data = await getJSON(url);
  const item = data.items?.[0];
  if (!item) return null;

  return {
    id: item.id,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.default?.url,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}

async function getLatestUpload(apiKey, uploadsPlaylistId) {
  const playlistUrl = `${API}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=1&key=${apiKey}`;
  const playlistData = await getJSON(playlistUrl);
  const item = playlistData.items?.[0];
  if (!item) return null;

  const videoId = item.contentDetails.videoId;

  const videoUrl = `${API}/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${apiKey}`;
  const videoData = await getJSON(videoUrl);
  const video = videoData.items?.[0];
  if (!video) return null;

  const live = video.liveStreamingDetails;
  const isCurrentlyLive = !!(live && live.actualStartTime && !live.actualEndTime);

  return {
    videoId,
    title: video.snippet.title,
    thumbnail: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url,
    publishedAt: video.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    isLive: isCurrentlyLive,
    liveStartedAt: live?.actualStartTime,
  };
}

module.exports = { resolveChannel, getLatestUpload };
