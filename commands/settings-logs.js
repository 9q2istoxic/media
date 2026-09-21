const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const { denyIfNotAdmin } = require('../utils/permissions');
const { LOG_CATEGORIES, findCategory } = require('../utils/logCategories');
const { getAllLogChannels, setLogChannel } = require('../utils/logSettings');

const CATEGORY_SELECT_ID = 'logcfg_pick_category';
const CHANNEL_SELECT_PREFIX = 'logcfg_pick_channel:';

function buildOverviewEmbed() {
  const channels = getAllLogChannels();
  const groups = [...new Set(LOG_CATEGORIES.map((c) => c.group))];

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('⚙️ Configuración de logs')
    .setDescription('Elige una categoría en el menú de abajo para configurar (o cambiar) su canal.');

  for (const group of groups) {
    const lines = LOG_CATEGORIES.filter((c) => c.group === group).map((c) => {
      const channelId = channels[c.id];
      return `**${c.label}** - ${channelId ? `<#${channelId}>` : '_sin configurar_'}`;
    });
    embed.addFields({ name: group, value: lines.join('\n'), inline: false });
  }

  return embed;
}

function buildCategorySelectRow() {
  const channels = getAllLogChannels();
  const menu = new StringSelectMenuBuilder()
    .setCustomId(CATEGORY_SELECT_ID)
    .setPlaceholder('Elige una categoría para configurar…')
    .addOptions(
      LOG_CATEGORIES.map((c) => ({
        label: c.label,
        value: c.id,
        description: (channels[c.id] ? 'Canal configurado' : 'Sin configurar').slice(0, 100),
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function buildChannelSelectRow(categoryId) {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(`${CHANNEL_SELECT_PREFIX}${categoryId}`)
    .setPlaceholder('Elige el canal de texto…')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);
  return new ActionRowBuilder().addComponents(menu);
}

async function handleCategoryPicked(interaction) {
  const categoryId = interaction.values[0];
  const category = findCategory(categoryId);
  if (!category) return interaction.update({ content: 'Categoría no válida.', embeds: [], components: [] });

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`⚙️ ${category.label}`)
    .setDescription(`${category.desc}\n\nElige el canal donde se enviarán estos logs.`);

  await interaction.update({ embeds: [embed], components: [buildChannelSelectRow(categoryId)] });
}

async function handleChannelPicked(interaction) {
  const categoryId = interaction.customId.slice(CHANNEL_SELECT_PREFIX.length);
  const channelId = interaction.values[0];
  setLogChannel(categoryId, channelId);

  await interaction.update({
    content: `✅ **${findCategory(categoryId)?.label || categoryId}** ahora se registra en <#${channelId}>.`,
    embeds: [buildOverviewEmbed()],
    components: [buildCategorySelectRow()],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings-logs')
    .setDescription('Configura en qué canal se registra cada categoría de logs (solo admin)'),

  async execute(interaction) {
    if (await denyIfNotAdmin(interaction)) return;
    await interaction.reply({
      embeds: [buildOverviewEmbed()],
      components: [buildCategorySelectRow()],
      ephemeral: true,
    });
  },

  CATEGORY_SELECT_ID,
  CHANNEL_SELECT_PREFIX,
  handleCategoryPicked,
  handleChannelPicked,
};
