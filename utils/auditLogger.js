const { getLogChannel } = require('./logSettings');

async function sendLog(client, categoryId, payload) {
  const channelId = getLogChannel(categoryId);
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) await channel.send(payload);
  } catch (err) {
    console.error(`[logs][${categoryId}] no se pudo enviar al canal ${channelId}:`, err.message);
  }
}

module.exports = { sendLog };
