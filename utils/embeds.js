const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const BRAND_TITLE = 'PRISMA · MEDIA ADMINISTRATION';

const COLORS = {
  youtubeVideo: 0xff0000,
  youtubeLive: 0xff0033,
  twitchLive: 0x9146ff,
  tiktokVideo: 0x000000,
  tiktokLive: 0xfe2c55,
  kickLive: 0x53fc18,
};

const YT_ICON = 'https://www.youtube.com/s/desktop/f506bd45/img/favicon_32.png';
const TWITCH_ICON = 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png';
const TIKTOK_ICON = 'https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop/8152caf0c8e8bc67ae0d.png';
const KICK_ICON = 'https://kick.com/favicon.ico';

function userTag(discordUserId) {
  return discordUserId ? `<@${discordUserId}>` : 'un creador';
}

function linkButton(label, url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url)
  );
}

function youtubeVideoEmbed({ discordUserId, title, url, thumbnail, publishedAt }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.youtubeVideo)
    .setAuthor({ name: BRAND_TITLE, iconURL: YT_ICON })
    .setTitle(title)
    .setURL(url)
    .setDescription(
      `**🎬 ${userTag(discordUserId)} acaba de subir un **vídeo nuevo** en **YouTube**.**`
    )
    .setImage(thumbnail)
    .setFooter({ text: 'YouTube · Nuevo vídeo' })
    .setTimestamp(publishedAt ? new Date(publishedAt) : new Date());

  return { embeds: [embed], components: [linkButton('▶️ Ver vídeo', url)] };
}

function youtubeLiveEmbed({ discordUserId, title, url, thumbnail, startedAt }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.youtubeLive)
    .setAuthor({ name: BRAND_TITLE, iconURL: YT_ICON })
    .setTitle(title)
    .setURL(url)
    .setDescription(
      `**🔴 ${userTag(discordUserId)} está **EN DIRECTO ahora mismo** en **YouTube**.**`
    )
    .setImage(thumbnail)
    .setFooter({ text: 'YouTube · En directo' })
    .setTimestamp(startedAt ? new Date(startedAt) : new Date());

  return { embeds: [embed], components: [linkButton('🔴 Ver directo', url)] };
}

function twitchLiveEmbed({ discordUserId, title, url, thumbnail, game, viewers, startedAt }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.twitchLive)
    .setAuthor({ name: BRAND_TITLE, iconURL: TWITCH_ICON })
    .setTitle(title || 'Directo en Twitch')
    .setURL(url)
    .setDescription(
      `**🔴 ${userTag(discordUserId)} está **EN DIRECTO ahora mismo** en **Twitch**.**`
    )
    .addFields(
      { name: 'Categoría', value: game || 'Sin especificar', inline: true },
      { name: 'Espectadores', value: String(viewers ?? '-'), inline: true }
    )
    .setImage(thumbnail)
    .setFooter({ text: 'Twitch · En directo' })
    .setTimestamp(startedAt ? new Date(startedAt) : new Date());

  return { embeds: [embed], components: [linkButton('🔴 Ver directo', url)] };
}

function tiktokVideoEmbed({ discordUserId, title, url, thumbnail, publishedAt }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.tiktokVideo)
    .setAuthor({ name: BRAND_TITLE, iconURL: TIKTOK_ICON })
    .setTitle(title?.slice(0, 250) || 'Nuevo vídeo en TikTok')
    .setURL(url)
    .setDescription(
      `**🎵 ${userTag(discordUserId)} acaba de subir un **vídeo nuevo** en **TikTok**.**`
    )
    .setImage(thumbnail)
    .setFooter({ text: 'TikTok · Nuevo vídeo' })
    .setTimestamp(publishedAt ? new Date(publishedAt) : new Date());

  return { embeds: [embed], components: [linkButton('🎵 Ver vídeo', url)] };
}

function tiktokLiveEmbed({ discordUserId, title, url, thumbnail }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.tiktokLive)
    .setAuthor({ name: BRAND_TITLE, iconURL: TIKTOK_ICON })
    .setTitle(title || 'Directo en TikTok')
    .setURL(url)
    .setDescription(
      `**🔴 ${userTag(discordUserId)} está **EN DIRECTO ahora mismo** en **TikTok**.**`
    )
    .setImage(thumbnail)
    .setFooter({ text: 'TikTok · En directo' })
    .setTimestamp(new Date());

  return { embeds: [embed], components: [linkButton('🔴 Ver directo', url)] };
}

function kickLiveEmbed({ discordUserId, title, url, thumbnail, viewers, startedAt }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.kickLive)
    .setAuthor({ name: BRAND_TITLE, iconURL: KICK_ICON })
    .setTitle(title || 'Directo en Kick')
    .setURL(url)
    .setDescription(
      `**🔴 ${userTag(discordUserId)} está **EN DIRECTO ahora mismo** en **Kick**.**`
    )
    .addFields({ name: 'Espectadores', value: String(viewers ?? '-'), inline: true })
    .setImage(thumbnail)
    .setFooter({ text: 'Kick · En directo' })
    .setTimestamp(startedAt ? new Date(startedAt) : new Date());

  return { embeds: [embed], components: [linkButton('🔴 Ver directo', url)] };
}

module.exports = {
  youtubeVideoEmbed,
  youtubeLiveEmbed,
  twitchLiveEmbed,
  tiktokVideoEmbed,
  tiktokLiveEmbed,
  kickLiveEmbed,
};
