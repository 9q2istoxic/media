const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { denyIfNotAdmin } = require('../utils/permissions');
const { addWarning, getWarningsFor } = require('../utils/warnings');
const { sendLog } = require('../utils/auditLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Añade una advertencia a un usuario (solo staff)')
    .addUserOption((opt) => opt.setName('user').setDescription('Usuario a advertir').setRequired(true))
    .addStringOption((opt) => opt.setName('motivo').setDescription('Motivo de la advertencia').setRequired(true)),

  async execute(interaction) {
    if (await denyIfNotAdmin(interaction)) return;

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('motivo', true);
    const warning = addWarning({ userId: user.id, staffId: interaction.user.id, reason });
    const total = getWarningsFor(user.id).length;

    const embed = new EmbedBuilder()
      .setColor(0xe0567b)
      .setTitle('⚠️ Advertencia registrada')
      .setDescription(`**Usuario:** <@${user.id}>\n**Motivo:** ${reason}\n**Por:** <@${interaction.user.id}>\n**Total de advertencias:** ${total}`)
      .setTimestamp();

    await sendLog(interaction.client, 'warns', { embeds: [embed] });

    const dmEmbed = new EmbedBuilder()
      .setColor(0xe0567b)
      .setTitle('⚠️ Has recibido una advertencia en PrismaMC')
      .setDescription(`**Motivo:** ${reason}\n**Por:** <@${interaction.user.id}>`)
      .setTimestamp();
    const dmSent = await user.send({ embeds: [dmEmbed] }).then(() => true).catch(() => false);

    return interaction.reply({
      content: `Advertencia registrada para <@${user.id}> (${total} en total). Código: \`${warning.id}\`.${dmSent ? '' : ' (No se pudo enviar el DM: tiene los DMs cerrados o bloqueó al bot.)'}`,
      ephemeral: true,
    });
  },
};
