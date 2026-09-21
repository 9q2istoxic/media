const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isMediaManagerMember } = require('../utils/ticketHandlers');
const { checkMinecraftUsername } = require('../utils/mojang');
const { resolveChannel } = require('../utils/youtube');
const { resolveUser: resolveTwitchUser } = require('../utils/twitch');
const { resolveUser: resolveKickUser } = require('../utils/kick');
const { resolveUser: resolveTiktokUser } = require('../utils/tiktok');

const STATUS_ICON = { ok: '✅', warn: '⚠️', fail: '❌', skip: '⏭️' };

async function safeCheck(fn, timeoutMs = 6000) {
  const start = Date.now();
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
    const result = await Promise.race([fn(), timeout]);
    return { ...result, ms: Date.now() - start };
  } catch (err) {
    return { status: 'fail', detail: err.message || 'error desconocido', ms: Date.now() - start };
  }
}

async function checkWeb() {
  const port = process.env.PORT || 30043;
  const res = await fetch(`http://127.0.0.1:${port}/api/health`);
  if (!res.ok) return { status: 'fail', detail: `HTTP ${res.status}` };
  const data = await res.json();
  return { status: data.ok ? 'ok' : 'warn', detail: data.ok ? 'responde' : 'respuesta inesperada' };
}

async function checkMojang() {
  const result = await checkMinecraftUsername('Notch');
  if (result.verified === true) return { status: 'ok', detail: 'responde y verifica' };
  if (result.verified === false) return { status: 'warn', detail: 'responde, pero no reconoció un nick de prueba válido' };
  return { status: 'fail', detail: result.reason || 'no se pudo comprobar' };
}

async function checkYoutube() {
  if (!process.env.YOUTUBE_API_KEY) return { status: 'skip', detail: 'YOUTUBE_API_KEY no configurada' };
  const channel = await resolveChannel(process.env.YOUTUBE_API_KEY, '@YouTube');
  return channel ? { status: 'ok', detail: 'API key válida' } : { status: 'warn', detail: 'respondió pero sin resultado' };
}

async function checkTwitch() {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    return { status: 'skip', detail: 'credenciales no configuradas' };
  }
  const user = await resolveTwitchUser(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, 'twitch');
  return user ? { status: 'ok', detail: 'token y API funcionando' } : { status: 'warn', detail: 'respondió pero sin resultado' };
}

async function checkKick() {
  if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET) {
    return { status: 'skip', detail: 'credenciales no configuradas' };
  }
  const user = await resolveKickUser(process.env.KICK_CLIENT_ID, process.env.KICK_CLIENT_SECRET, 'kick');
  return user ? { status: 'ok', detail: 'token y API funcionando' } : { status: 'warn', detail: 'respondió pero sin resultado' };
}

async function checkTiktok() {
  const user = await resolveTiktokUser('tiktok');
  return user ? { status: 'ok', detail: 'scraping funcionando' } : { status: 'warn', detail: 'no se pudo leer el perfil de prueba' };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Latencia y estado de todas las integraciones (solo Media Manager)'),

  async execute(interaction) {
    if (!isMediaManagerMember(interaction.member)) {
      return interaction.reply({ content: 'Solo Media Manager puede usar este comando.', ephemeral: true });
    }

    const start = Date.now();
    await interaction.deferReply({ ephemeral: true });
    const roundtripMs = Date.now() - start;
    const wsPing = interaction.client.ws.ping;

    const [web, mojang, youtube, twitch, kick, tiktok] = await Promise.all([
      safeCheck(checkWeb),
      safeCheck(checkMojang),
      safeCheck(checkYoutube),
      safeCheck(checkTwitch),
      safeCheck(checkKick),
      safeCheck(checkTiktok),
    ]);

    const uptimeMs = interaction.client.uptime || 0;
    const uptimeMin = Math.floor(uptimeMs / 60000);

    const line = (label, r) => `${STATUS_ICON[r.status] || '❔'} **${label}** - ${r.detail}${r.ms ? ` (${r.ms}ms)` : ''}`;

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('🏓 Pong - diagnóstico completo')
      .addFields(
        { name: 'Latencia', value: `WebSocket: **${wsPing}ms**\nRoundtrip API: **${roundtripMs}ms**\nUptime del bot: **${uptimeMin} min**`, inline: false },
        { name: 'Web', value: line('Servidor web', web), inline: false },
        {
          name: 'Integraciones externas',
          value: [
            line('Mojang (Minecraft)', mojang),
            line('YouTube', youtube),
            line('Twitch', twitch),
            line('Kick', kick),
            line('TikTok', tiktok),
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'PrismaMC · Diagnóstico' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
