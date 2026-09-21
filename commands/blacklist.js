const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { denyIfNotAdmin } = require('../utils/permissions');
const { addToBlacklist, removeFromBlacklist, listBlacklist } = require('../utils/blacklist');
const { getApplicationsByDiscordId } = require('../utils/applications');
const { getConfig } = require('../utils/config');

async function logToBlacklistChannel(client, embed) {
  const channelId = getConfig().blacklistLogChannelId;
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Gestiona la blacklist de solicitudes (solo admin)')
    .addSubcommand((sub) => sub.setName('add').setDescription('Añade a alguien a la blacklist')
      .addUserOption((opt) => opt.setName('user').setDescription('Usuario a bloquear').setRequired(true))
      .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo').setRequired(false)))
    .addSubcommand((sub) => sub.setName('remove').setDescription('Quita a alguien de la blacklist')
      .addUserOption((opt) => opt.setName('user').setDescription('Usuario a desbloquear').setRequired(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('Lista quién está en la blacklist')),

  async execute(interaction) {
    if (await denyIfNotAdmin(interaction)) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('motivo') || 'Sin motivo';

      const lastApp = getApplicationsByDiscordId(user.id)[0] || null;
      addToBlacklist(user.id, interaction.user.id, reason, lastApp?.ip || null);

      await logToBlacklistChannel(interaction.client, new EmbedBuilder()
        .setColor(0xe0567b)
        .setTitle('🚫 Usuario añadido a la blacklist')
        .setDescription(`**Usuario:** <@${user.id}> (\`${user.id}\`)\n**Motivo:** ${reason}\n**Por:** <@${interaction.user.id}>`)
        .setTimestamp());

      return interaction.reply({ content: `<@${user.id}> ya no puede mandar ni renovar solicitudes.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user', true);
      const existed = removeFromBlacklist(user.id);

      if (existed) {
        await logToBlacklistChannel(interaction.client, new EmbedBuilder()
          .setColor(0x74c261)
          .setTitle('✅ Usuario quitado de la blacklist')
          .setDescription(`**Usuario:** <@${user.id}> (\`${user.id}\`)\n**Por:** <@${interaction.user.id}>`)
          .setTimestamp());
      }

      return interaction.reply({
        content: existed ? `<@${user.id}> ya puede volver a mandar solicitudes.` : `<@${user.id}> no estaba en la blacklist.`,
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const entries = Object.entries(listBlacklist());
      if (!entries.length) return interaction.reply({ content: 'La blacklist está vacía.', ephemeral: true });

      const lines = entries.map(([id, e]) => `<@${id}> - ${e.reason} (por <@${e.staffId}>, <t:${Math.floor(e.addedAt / 1000)}:R>)`);
      const embed = new EmbedBuilder().setColor(0xe0567b).setTitle('🚫 Blacklist').setDescription(lines.join('\n')).setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
