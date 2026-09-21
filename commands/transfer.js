const { SlashCommandBuilder } = require('discord.js');
const { handleTransferButton } = require('../utils/ticketHandlers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfiere la visibilidad de este ticket (solo Media Manager, úsalo dentro de un ticket)'),

  async execute(interaction) {
    return handleTransferButton(interaction);
  },
};
