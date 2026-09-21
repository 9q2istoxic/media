const { SlashCommandBuilder } = require('discord.js');
const { removeSubscription } = require('../utils/subscriptions');
const { denyIfNotAdmin } = require('../utils/permissions');
const { logSubscriptionRemoved } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeplatform')
    .setDescription('Elimina una suscripción de notificaciones (solo staff)')
    .addStringOption((opt) =>
      opt
        .setName('plataforma')
        .setDescription('Plataforma')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube', value: 'youtube' },
          { name: 'Twitch', value: 'twitch' },
          { name: 'TikTok', value: 'tiktok' }
        )
    )
    .addStringOption((opt) =>
      opt.setName('canal').setDescription('ID/handle de YouTube o usuario de Twitch').setRequired(true)
    ),

  async execute(interaction) {
    if (await denyIfNotAdmin(interaction)) return;

    const platform = interaction.options.getString('plataforma');
    const rawInput = interaction.options.getString('canal');

    const removed = removeSubscription(platform, rawInput);
    if (removed) {
      await logSubscriptionRemoved(interaction.client, {
        staff: interaction.user,
        platform,
        externalId: rawInput,
        guild: interaction.guild,
      });
      return interaction.reply({ content: `🗑️ Suscripción eliminada: \`${rawInput}\` (${platform}).`, ephemeral: true });
    }
    return interaction.reply({
      content: `❌ No encontré ninguna suscripción activa de \`${rawInput}\` en ${platform}.`,
      ephemeral: true,
    });
  },
};
