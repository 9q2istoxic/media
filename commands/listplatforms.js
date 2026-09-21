const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listAll } = require('../utils/subscriptions');

function daysLeft(expiresAt) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listplatforms')
    .setDescription('Muestra las suscripciones activas y cuántos días les quedan'),

  async execute(interaction) {
    const subs = listAll();
    if (subs.length === 0) {
      return interaction.reply({ content: 'No hay ninguna suscripción activa ahora mismo.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('📋 Suscripciones activas')
      .setDescription(
        subs
          .map((s) => {
            const icon = s.platform === 'youtube' ? '🔴 YouTube' : s.platform === 'twitch' ? '🟣 Twitch' : '⚫ TikTok';
            const user = s.discordUserId ? `<@${s.discordUserId}>` : 'Sin asignar';
            const role = s.roleKey ? ` · Rol: **${s.roleKey}**` : '';
            return `**${s.displayName}** - ${icon}\n↳ Usuario: ${user}${role} · Canal: <#${s.discordChannelId}> · Expira en **${daysLeft(s.expiresAt)} días**`;
          })
          .join('\n\n')
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
