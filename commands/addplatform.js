const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { addSubscription } = require('../utils/subscriptions');
const { resolveChannel } = require('../utils/youtube');
const { resolveUser: resolveTwitchUser } = require('../utils/twitch');
const { resolveUser: resolveTiktokUser } = require('../utils/tiktok');
const { denyIfNotAdmin } = require('../utils/permissions');
const { getConfig } = require('../utils/config');
const { logSubscriptionAdded, logRoleAssigned } = require('../utils/logger');

const ROLE_CHOICES = ['MEDIA', 'YOUTUBE', 'PARTNER', 'FAMOUS', 'TWITCH', 'TIKTOK'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addplatform')
    .setDescription('Asigna 14 días de notificaciones y un rol a un usuario (solo staff)')
    .addUserOption((opt) => opt.setName('user').setDescription('Usuario al que se le asigna').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('role')
        .setDescription('Categoría de rol a asignar')
        .setRequired(true)
        .addChoices(...ROLE_CHOICES.map((r) => ({ name: r, value: r })))
    )
    .addStringOption((opt) =>
      opt
        .setName('plataforma')
        .setDescription('Plataforma a seguir')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube', value: 'youtube' },
          { name: 'Twitch', value: 'twitch' },
          { name: 'TikTok', value: 'tiktok' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('canal')
        .setDescription('ID/handle de YouTube (@handle o UCxxxx), usuario de Twitch, o @usuario de TikTok')
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('destino')
        .setDescription('Canal de Discord donde avisar (por defecto el fijado en config.json)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (await denyIfNotAdmin(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const roleKey = interaction.options.getString('role');
    const platform = interaction.options.getString('plataforma');
    const rawInput = interaction.options.getString('canal');
    const destino = interaction.options.getChannel('destino');
    const config = getConfig();
    const discordChannelId = destino ? destino.id : config.notificationChannelId;

    if (!discordChannelId || discordChannelId.startsWith('PON_AQUI')) {
      return interaction.editReply('⚠️ No hay un canal de notificaciones configurado en `config.json` (`notificationChannelId`) y no indicaste `destino`.');
    }

    const assignedRoleId = config.roles?.[roleKey];
    if (!assignedRoleId || assignedRoleId.startsWith('PON_AQUI')) {
      return interaction.editReply(`⚠️ El rol \`${roleKey}\` no tiene un ID configurado en \`config.json\` → \`roles.${roleKey}\`.`);
    }

    try {
      let result;
      let displayName;

      if (platform === 'youtube') {
        const channel = await resolveChannel(process.env.YOUTUBE_API_KEY, rawInput);
        if (!channel) return interaction.editReply(`❌ No encontré ningún canal de YouTube para \`${rawInput}\`.`);
        displayName = channel.title;
        result = addSubscription({
          platform: 'youtube',
          externalId: channel.id,
          displayName: channel.title,
          discordChannelId,
          discordUserId: targetUser.id,
          roleKey,
          assignedRoleId,
          guildId: interaction.guildId,
        });
      } else if (platform === 'twitch') {
        const user = await resolveTwitchUser(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET, rawInput);
        if (!user) return interaction.editReply(`❌ No encontré ningún usuario de Twitch \`${rawInput}\`.`);
        displayName = user.displayName;
        result = addSubscription({
          platform: 'twitch',
          externalId: user.login,
          displayName: user.displayName,
          discordChannelId,
          discordUserId: targetUser.id,
          roleKey,
          assignedRoleId,
          guildId: interaction.guildId,
        });
      } else {
        const user = await resolveTiktokUser(rawInput);
        if (!user) return interaction.editReply(`❌ No encontré ningún usuario de TikTok \`${rawInput}\`. (TikTok es inseguro, si el error persiste comunicale a @9q2istoxic).`);
        displayName = user.displayName;
        result = addSubscription({
          platform: 'tiktok',
          externalId: user.username,
          displayName: user.displayName,
          discordChannelId,
          discordUserId: targetUser.id,
          roleKey,
          assignedRoleId,
          guildId: interaction.guildId,
        });
      }

      const { subscription, renewed } = result;

      let roleGivenOk = false;
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await member.roles.add(assignedRoleId);
        roleGivenOk = true;
        await logRoleAssigned(interaction.client, {
          staff: interaction.user,
          targetUser,
          roleId: assignedRoleId,
          roleKey,
          guild: interaction.guild,
        });
      } catch (roleErr) {
        console.error('[addplatform] No se pudo asignar el rol:', roleErr.message);
      }

      await logSubscriptionAdded(interaction.client, {
        staff: interaction.user,
        targetUser,
        platform,
        externalId: subscription.externalId,
        displayName,
        discordChannelId,
        expiresAt: subscription.expiresAt,
        renewed,
        roleKey,
        guild: interaction.guild,
      });

      const roleWarning = roleGivenOk ? '' : '\n⚠️ No pude asignarle el rol de Discord (revisa que el bot tenga permiso "Gestionar roles" y que su rol esté por encima del rol a asignar).';

      return interaction.editReply(
        `✅ ${renewed ? 'Renovado (14 días más)' : 'Añadido'}: **${displayName}** (${platform}) asignado a <@${targetUser.id}> con rol **${roleKey}** → <#${discordChannelId}>. Expira <t:${Math.floor(subscription.expiresAt / 1000)}:R>.${roleWarning}`
      );
    } catch (err) {
      console.error('[addplatform] Error:', err);
      return interaction.editReply('⚠️ Ocurrió un error consultando la API. Revisa las API keys en `.env`.');
    }
  },
};
