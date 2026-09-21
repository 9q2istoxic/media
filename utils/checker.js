const { listAll, updateSubscription, purgeExpired } = require('./subscriptions');
const { getLatestUpload, resolveChannel } = require('./youtube');
const { getLiveStream } = require('./twitch');
const { getLiveStream: getKickLiveStream } = require('./kick');
const { getLatestVideo, getLiveStatus } = require('./tiktok');
const { youtubeVideoEmbed, youtubeLiveEmbed, twitchLiveEmbed, tiktokVideoEmbed, tiktokLiveEmbed, kickLiveEmbed } = require('./embeds');
const { logSubscriptionExpired, logNewUpload, logRoleRemoved, logRenewalWarning } = require('./logger');

const DAY_MS = 24 * 60 * 60 * 1000;

async function sendMessage(client, discordChannelId, payload) {
  try {
    const channel = await client.channels.fetch(discordChannelId);
    if (channel) await channel.send(payload);
  } catch (err) {
    console.error(`[checker] No pude enviar al canal ${discordChannelId}:`, err.message);
  }
}

async function dmUser(client, userId, payload) {
  try {
    const user = await client.users.fetch(userId);
    if (user) await user.send(payload);
  } catch (err) {
    console.error(`[checker] No pude mandar DM a ${userId}:`, err.message);
  }
}

function getAnnouncementChannelId(kind, sub) {
  const config = require('./config').getConfig();
  if (kind === 'video') return config.videoNotificationChannelId || sub.discordChannelId || config.notificationChannelId || null;
  if (kind === 'live') return config.liveNotificationChannelId || sub.discordChannelId || config.notificationChannelId || null;
  return sub.discordChannelId || config.notificationChannelId || null;
}

async function checkYoutube(client, sub) {
  try {
    if (!sub.uploadsPlaylistId) {
      const channel = await resolveChannel(process.env.YOUTUBE_API_KEY, sub.externalId);
      if (!channel) return;
      updateSubscription(sub.id, { uploadsPlaylistId: channel.uploadsPlaylistId });
      sub.uploadsPlaylistId = channel.uploadsPlaylistId;
    }

    const latest = await getLatestUpload(process.env.YOUTUBE_API_KEY, sub.uploadsPlaylistId);
    if (!latest) return;

    if (sub.baselineNeeded) {
      updateSubscription(sub.id, {
        baselineNeeded: false,
        lastVideoId: latest.isLive ? sub.lastVideoId : latest.videoId,
        lastLiveVideoId: latest.isLive ? latest.videoId : sub.lastLiveVideoId,
      });
      return;
    }

    if (latest.isLive) {
      if (sub.lastLiveVideoId !== latest.videoId) {
        const payload = youtubeLiveEmbed({
          discordUserId: sub.discordUserId,
          title: latest.title,
          url: latest.url,
          thumbnail: latest.thumbnail,
          startedAt: latest.liveStartedAt,
        });
        await sendMessage(client, getAnnouncementChannelId('live', sub), payload);
        await logNewUpload(client, {
          platform: 'youtube',
          type: '🔴 Directo',
          sub,
          url: latest.url,
          title: latest.title,
        });
        updateSubscription(sub.id, { lastLiveVideoId: latest.videoId });
      }
    } else if (sub.lastVideoId !== latest.videoId) {
      const payload = youtubeVideoEmbed({
        discordUserId: sub.discordUserId,
        title: latest.title,
        url: latest.url,
        thumbnail: latest.thumbnail,
        publishedAt: latest.publishedAt,
      });
      await sendMessage(client, getAnnouncementChannelId('video', sub), payload);
      await logNewUpload(client, {
        platform: 'youtube',
        type: '🎬 Vídeo',
        sub,
        url: latest.url,
        title: latest.title,
      });
      updateSubscription(sub.id, { lastVideoId: latest.videoId });
    }
  } catch (err) {
    console.error(`[checker][youtube] ${sub.displayName}:`, err.message);
  }
}

async function checkTwitch(client, sub) {
  try {
    const stream = await getLiveStream(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, sub.externalId);

    if (sub.baselineNeeded) {
      updateSubscription(sub.id, {
        baselineNeeded: false,
        isLiveTwitch: !!stream,
        lastTwitchStreamId: stream ? stream.streamId : sub.lastTwitchStreamId,
      });
      return;
    }

    if (stream && sub.lastTwitchStreamId !== stream.streamId) {
      const url = `https://twitch.tv/${sub.externalId}`;
      const payload = twitchLiveEmbed({
        discordUserId: sub.discordUserId,
        title: stream.title,
        url,
        thumbnail: stream.thumbnail,
        game: stream.game,
        viewers: stream.viewers,
        startedAt: stream.startedAt,
      });
      await sendMessage(client, getAnnouncementChannelId('live', sub), payload);
      await logNewUpload(client, {
        platform: 'twitch',
        type: '🔴 Directo',
        sub,
        url,
        title: stream.title,
        extra: `Categoría: ${stream.game || '-'} · Espectadores: ${stream.viewers ?? '-'}`,
      });
      updateSubscription(sub.id, { isLiveTwitch: true, lastTwitchStreamId: stream.streamId });
    } else if (!stream && sub.isLiveTwitch) {
      updateSubscription(sub.id, { isLiveTwitch: false });
    }
  } catch (err) {
    console.error(`[checker][twitch] ${sub.displayName}:`, err.message);
  }
}

async function checkKick(client, sub) {
  try {
    const stream = await getKickLiveStream(process.env.KICK_CLIENT_ID, process.env.KICK_CLIENT_SECRET, sub.externalId);

    if (sub.baselineNeeded) {
      updateSubscription(sub.id, {
        baselineNeeded: false,
        isLiveKick: !!stream,
        lastKickStreamId: stream ? stream.streamId : sub.lastKickStreamId,
      });
      return;
    }

    if (stream && sub.lastKickStreamId !== stream.streamId) {
      const url = `https://kick.com/${sub.externalId}`;
      const payload = kickLiveEmbed({
        discordUserId: sub.discordUserId,
        title: stream.title,
        url,
        thumbnail: stream.thumbnail,
        viewers: stream.viewers,
        startedAt: stream.startedAt,
      });
      await sendMessage(client, getAnnouncementChannelId('live', sub), payload);
      await logNewUpload(client, {
        platform: 'kick',
        type: '🔴 Directo',
        sub,
        url,
        title: stream.title,
        extra: `Espectadores: ${stream.viewers ?? '-'}`,
      });
      updateSubscription(sub.id, { isLiveKick: true, lastKickStreamId: stream.streamId });
    } else if (!stream && sub.isLiveKick) {
      updateSubscription(sub.id, { isLiveKick: false });
    }
  } catch (err) {
    console.error(`[checker][kick] ${sub.displayName}:`, err.message);
  }
}

async function stripExpiredRole(client, sub) {
  if (!sub.assignedRoleId || !sub.discordUserId || !sub.guildId) return;

  try {
    const guild = await client.guilds.fetch(sub.guildId);
    const member = await guild.members.fetch(sub.discordUserId);
    await member.roles.remove(sub.assignedRoleId);
    await logRoleRemoved(client, {
      targetUserId: sub.discordUserId,
      roleId: sub.assignedRoleId,
      roleKey: sub.roleKey,
      guild,
      success: true,
    });
  } catch (err) {
    let guild = null;
    try {
      guild = await client.guilds.fetch(sub.guildId);
    } catch {

    }
    await logRoleRemoved(client, {
      targetUserId: sub.discordUserId,
      roleId: sub.assignedRoleId,
      roleKey: sub.roleKey,
      guild,
      success: false,
      reason: err.message,
    });
  }
}

async function checkTiktok(client, sub) {
  try {
    const [video, live] = await Promise.all([
      getLatestVideo(sub.externalId).catch(() => null),
      getLiveStatus(sub.externalId).catch(() => null),
    ]);

    if (sub.baselineNeeded) {
      updateSubscription(sub.id, {
        baselineNeeded: false,
        lastTiktokVideoId: video ? video.videoId : sub.lastTiktokVideoId,
        isLiveTiktok: !!live,
        lastTiktokRoomId: live ? live.roomId : sub.lastTiktokRoomId,
      });
      return;
    }

    if (live && sub.lastTiktokRoomId !== live.roomId) {
      const payload = tiktokLiveEmbed({
        discordUserId: sub.discordUserId,
        title: live.title,
        url: live.url,
        thumbnail: live.cover,
      });
      await sendMessage(client, getAnnouncementChannelId('live', sub), payload);
      await logNewUpload(client, { platform: 'tiktok', type: '🔴 Directo', sub, url: live.url, title: live.title });
      updateSubscription(sub.id, { isLiveTiktok: true, lastTiktokRoomId: live.roomId });
    } else if (!live && sub.isLiveTiktok) {
      updateSubscription(sub.id, { isLiveTiktok: false });
    }

    if (video && sub.lastTiktokVideoId !== video.videoId) {
      const payload = tiktokVideoEmbed({
        discordUserId: sub.discordUserId,
        title: video.description,
        url: video.url,
        thumbnail: video.cover,
        publishedAt: video.createdAt,
      });
      await sendMessage(client, getAnnouncementChannelId('video', sub), payload);
      await logNewUpload(client, { platform: 'tiktok', type: '🎵 Vídeo', sub, url: video.url, title: video.description });
      updateSubscription(sub.id, { lastTiktokVideoId: video.videoId });
    }
  } catch (err) {
    console.error(`[checker][tiktok] ${sub.displayName}:`, err.message);
  }
}

async function maybeWarnRenewal(client, sub) {
  const remaining = sub.expiresAt - Date.now();
  if (remaining <= 0) return;

  const daysLeft = Math.ceil(remaining / DAY_MS);
  const userId = sub.discordUserId;
  const expiresAtText = `<t:${Math.floor(sub.expiresAt / 1000)}:F>`;

  if (remaining <= DAY_MS && !sub.warn1dSentAt) {
    updateSubscription(sub.id, { warn1dSentAt: Date.now() });
    const content = {
      embeds: [
        {
          color: 0xffa94d,
          title: '⏳ Tu rango está a 1 día de vencer',
          description: `Tu rango para **${sub.displayName || sub.externalId}** vence ${expiresAtText}. Renuévalo cuanto antes para no perder las notificaciones.`,
        },
      ],
    };
    if (userId) await dmUser(client, userId, content);
    await logRenewalWarning(client, { sub, daysLeft, threshold: 1 });
    return;
  }

  if (remaining <= 3 * DAY_MS && remaining > DAY_MS && !sub.warn3dSentAt) {
    updateSubscription(sub.id, { warn3dSentAt: Date.now() });
    const content = {
      embeds: [
        {
          color: 0x38bdf8,
          title: '⏳ Tu rango vence en 3 días',
          description: `Tu rango para **${sub.displayName || sub.externalId}** vence ${expiresAtText}. Quedan aproximadamente **${daysLeft} días**.`,
        },
      ],
    };
    if (userId) await dmUser(client, userId, content);
    await logRenewalWarning(client, { sub, daysLeft, threshold: 3 });
  }
}

async function runCheckCycle(client) {
  const expired = purgeExpired();
  for (const sub of expired) {
    await logSubscriptionExpired(client, sub);
    await stripExpiredRole(client, sub);
  }

  const subs = listAll();
  for (const sub of subs) {
    await maybeWarnRenewal(client, sub);

    if (sub.platform === 'youtube') await checkYoutube(client, sub);
    if (sub.platform === 'twitch') await checkTwitch(client, sub);
    if (sub.platform === 'tiktok') await checkTiktok(client, sub);
    if (sub.platform === 'kick') await checkKick(client, sub);
  }
}

function startChecker(client) {
  const minutes = Number(process.env.POLL_INTERVAL_MINUTES || 2);
  const intervalMs = Math.max(1, minutes) * 60 * 1000;

  runCheckCycle(client).catch((e) => console.error('[checker] Error en ciclo inicial:', e));

  setInterval(() => {
    runCheckCycle(client).catch((e) => console.error('[checker] Error en ciclo:', e));
  }, intervalMs);

  console.log(`[checker] Revisando plataformas cada ${minutes} minuto(s).`);
}

module.exports = { startChecker };
