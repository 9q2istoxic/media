
async function checkIp(ip) {
  const apiKey = process.env.IPHUB_API_KEY;
  if (!apiKey || !ip) return { checked: false };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://v2.api.iphub.info/ip/${encodeURIComponent(ip)}`, {
      headers: { 'X-Key': apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { checked: false };

    const data = await res.json();

    return { checked: true, isVpn: data.block === 1, block: data.block, blockReason: data.blockReason || null };
  } catch {
    return { checked: false };
  }
}

module.exports = { checkIp };
