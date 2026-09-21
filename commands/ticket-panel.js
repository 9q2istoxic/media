const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { denyIfNotAdmin } = require('../utils/permissions');
const { getConfig } = require('../utils/config');

const PANEL_SELECT_ID = 'ticket_panel_select';

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('Media Support | PrismaMC Network')
    .setDescription('¿Necesitas ayuda? \nNo dudes en Crear un Ticket, selecciona una categoría del menú desplegable según el tipo de ayuda que necesites');
}

function buildPanelSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(PANEL_SELECT_ID)
    .setPlaceholder('Selecciona una categoría…')
    .addOptions(
      { label: 'Soporte general', value: 'general', emoji: '🙋' },
      { label: 'Media apply', value: 'media_apply', emoji: '🎬', description: 'No es el sistema de solicitudes - te indicamos cómo aplicar' },
      { label: 'Reporte de un Media', value: 'report', emoji: '🚩' },
    );
  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  PANEL_SELECT_ID,
  buildPanelEmbed,
  buildPanelSelectRow,

  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Publica (o refresca) el panel de creación de tickets en este canal (solo admin)'),

  async execute(interaction) {
    if (await denyIfNotAdmin(interaction)) return;

    const config = getConfig();
    const panelChannelId = config.tickets?.panelChannelId;
    const channel = panelChannelId
      ? await interaction.guild.channels.fetch(panelChannelId).catch(() => null)
      : interaction.channel;

    if (!channel) {
      return interaction.reply({ content: 'No encontré el canal del panel configurado (`tickets.panelChannelId`).', ephemeral: true });
    }

    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (recent) {
      const mine = recent.filter((m) => m.author.id === interaction.client.user.id);
      for (const m of mine.values()) await m.delete().catch(() => {});
    }

    await channel.send({ embeds: [buildPanelEmbed()], components: [buildPanelSelectRow()] });
    return interaction.reply({ content: `✅ Panel publicado en <#${channel.id}>.`, ephemeral: true });
  },
};
