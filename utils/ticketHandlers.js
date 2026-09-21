const {
  ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder, UserSelectMenuBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getConfig } = require('./config');
const {
  createTicket, getTicket, updateTicket, removeTicket, getOpenTicketChannelId,
  saveClosedSnapshot, getClosedSnapshot, hasRated, markRated,
  setPendingRating, getPendingRating, clearPendingRating,
  setRatingMessageRef, getRatingMessageRef, clearRatingMessageRef,
} = require('./tickets');
const { generateTicketTranscript } = require('./ticketTranscript');

const CATEGORY_LABELS = { general: 'Soporte general', report: 'Reporte de un Media' };

const openMediaApplyChannels = new Map();

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'staff';
}

function ticketStaffRoleIds() {
  const config = getConfig();
  return [config.adminRoleId, config.mediaManagerRoleId, config.staffAssistantRoleId].filter(Boolean);
}

function isTicketStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  return ticketStaffRoleIds().some((roleId) => member.roles?.cache?.has(roleId));
}

function ticketPermissionOverwrites(guild, userId) {
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: userId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles],
    },
  ];
  for (const roleId of ticketStaffRoleIds()) {
    overwrites.push({
      id: roleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages],
    });
  }
  return overwrites;
}

function isMediaManagerMember(member) {
  if (!member) return false;
  const config = getConfig();
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  return !!(config.mediaManagerRoleId && member.roles?.cache?.has(config.mediaManagerRoleId));
}

function ticketActionRow(disabled = false, claimedByLabel = null) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel(claimedByLabel ? `Reclamado por ${claimedByLabel}` : 'Reclamar')
      .setEmoji('✋').setStyle(ButtonStyle.Success).setDisabled(disabled || !!claimedByLabel),
    new ButtonBuilder().setCustomId('ticket_close').setLabel(disabled ? 'Cerrado' : 'Cerrar')
      .setEmoji('🔒').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId('ticket_transfer').setLabel('Transferir')
      .setEmoji('🔄').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}

function buildGeneralModal() {
  return new ModalBuilder()
    .setCustomId('ticket_modal_general')
    .setTitle('Soporte general')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ign').setLabel('¿Cuál es tu Nick de Minecraft?')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('motivo').setLabel('Explica el motivo de tu consulta.')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
      )
    );
}

function buildReportModal() {
  return new ModalBuilder()
    .setCustomId('ticket_modal_report')
    .setTitle('Reporte de un Media')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ign').setLabel('¿Cuál es tu nick?')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reported_ign').setLabel('¿Cuál es el nick del media que reportas?')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('¿Por qué estás reportando a este media?')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
      )
    );
}

async function handlePanelSelect(interaction) {
  const value = interaction.values[0];
  const existing = getOpenTicketChannelId(interaction.user.id);
  if (existing && interaction.guild.channels.cache.has(existing)) {
    return interaction.reply({ content: `Ya tienes un ticket abierto: <#${existing}>`, ephemeral: true });
  }

  if (value === 'general') return interaction.showModal(buildGeneralModal());
  if (value === 'report') return interaction.showModal(buildReportModal());
  if (value === 'media_apply') return handleMediaApply(interaction);

  return interaction.reply({ content: 'Categoría no reconocida.', ephemeral: true });
}

async function handleMediaApply(interaction) {
  const existingChannelId = openMediaApplyChannels.get(interaction.user.id);
  if (existingChannelId && interaction.guild.channels.cache.has(existingChannelId)) {
    return interaction.reply({ content: `Ya tienes uno abierto: <#${existingChannelId}>`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const config = getConfig();
  const categoryId = config.tickets?.categoryId;
  const guild = interaction.guild;

  const channel = await guild.channels.create({
    name: `media-apply-${interaction.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    permissionOverwrites: ticketPermissionOverwrites(guild, interaction.user.id),
  });
  openMediaApplyChannels.set(interaction.user.id, channel.id);

  const base = process.env.PUBLIC_BASE_URL || process.env.BASE_URL || 'http://apply.staff-prismamc.net:30043/';
  const infoEmbed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('🎬 Media apply')
    .setDescription(
      `¡Hola <@${interaction.user.id}>! Las apply de media ahora se hacen desde la web\n\n` +
      `**Estos son los pasos:**\n` +
      `1. Entra a ${base} e inicia sesión con Discord.\n` +
      `2. Pulsa **"Empezar solicitud"** en tu panel.\n` +
      `3. Elige tu categoría y plataforma, rellena tus datos y sube tu captura de estadísticas.\n` +
      `4. El staff revisa tu solicitud y te avisa por Discord.`
    );
  const warnEmbed = new EmbedBuilder()
    .setColor(0xf2a43a)
    .setDescription('⏳ Este ticket es solo informativo y se eliminará automáticamente en **3 minutos**.');

  await channel.send({ content: `<@${interaction.user.id}>`, embeds: [infoEmbed] });
  await channel.send({ embeds: [warnEmbed] });

  setTimeout(() => {
    channel.delete().catch(() => {});
    if (openMediaApplyChannels.get(interaction.user.id) === channel.id) openMediaApplyChannels.delete(interaction.user.id);
  }, 3 * 60 * 1000);

  return interaction.editReply({ content: `Te expliqué los pasos en <#${channel.id}> (se borra sola en 3 minutos).` });
}

async function createRealTicket(interaction, category, answers) {
  const config = getConfig();
  const categoryId = config.tickets?.categoryId;
  const guild = interaction.guild;

  const channel = await guild.channels.create({
    name: 'ticket-pendiente',
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    permissionOverwrites: ticketPermissionOverwrites(guild, interaction.user.id),
  });

  const fields = Object.entries(answers).map(([key, value]) => ({
    name: key === 'ign' ? 'Nick de Minecraft' : key === 'reported_ign' ? 'Media reportado' : key === 'motivo' ? 'Motivo' : key === 'reason' ? 'Razón del reporte' : key,
    value: value || '-',
    inline: false,
  }));

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`🎫 Ticket · ${CATEGORY_LABELS[category] || category}`)
    .addFields(
      { name: 'Usuario', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: false },
      ...fields
    )
    .setFooter({ text: 'PrismaMC · Sistema de Tickets' })
    .setTimestamp();

  const assistantMention = config.staffAssistantRoleId ? `<@&${config.staffAssistantRoleId}>` : '';
  await channel.send({ content: `<@${interaction.user.id}> ${assistantMention}`, embeds: [embed], components: [ticketActionRow()] });

  createTicket({ channelId: channel.id, userId: interaction.user.id, category, answers });

  return channel;
}

async function handleModalSubmit(interaction) {
  if (interaction.customId === 'ticket_modal_general') {
    const answers = { ign: interaction.fields.getTextInputValue('ign'), motivo: interaction.fields.getTextInputValue('motivo') };
    await interaction.deferReply({ ephemeral: true });
    const channel = await createRealTicket(interaction, 'general', answers);
    return interaction.editReply({ content: `Ticket creado: <#${channel.id}>` });
  }
  if (interaction.customId === 'ticket_modal_report') {
    const answers = {
      ign: interaction.fields.getTextInputValue('ign'),
      reported_ign: interaction.fields.getTextInputValue('reported_ign'),
      reason: interaction.fields.getTextInputValue('reason'),
    };
    await interaction.deferReply({ ephemeral: true });
    const channel = await createRealTicket(interaction, 'report', answers);
    return interaction.editReply({ content: `Ticket creado: <#${channel.id}>` });
  }
}

async function handleClaim(interaction) {
  if (!isTicketStaff(interaction.member)) {
    return interaction.reply({ content: 'Solo el staff puede reclamar tickets.', ephemeral: true });
  }
  const ticket = getTicket(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'No encontré datos de este ticket.', ephemeral: true });
  if (ticket.claimedBy) return interaction.reply({ content: `Ya lo reclamó <@${ticket.claimedBy}>.`, ephemeral: true });

  await interaction.deferUpdate();
  updateTicket(interaction.channel.id, { claimedBy: interaction.user.id });

  await interaction.channel.setName(`ticket-${slugify(interaction.user.username)}`).catch(() => {});
  await interaction.channel.send({
    content: `¡Hola, <@${ticket.userId}>! Bienvenido al sistema de tickets de PrismaMC. Nos alegra mucho contar contigo. Tu ticket será atendido por <@${interaction.user.id}>, un miembro dedicado de nuestro equipo. Estamos seguros de que recibirás la ayuda que necesitas. ¡No dudes en contactarnos para cualquier cosa en la que podamos ayudarte!`,
  });
  await interaction.message.edit({ components: [ticketActionRow(false, interaction.user.username)] }).catch(() => {});
}

function transferChoiceRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_transfer_pick:category').setLabel('Categoría').setEmoji('🏷️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_transfer_pick:role').setLabel('Rol').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_transfer_pick:person').setLabel('Persona').setEmoji('👤').setStyle(ButtonStyle.Secondary),
  );
}

async function handleTransferButton(interaction) {
  if (!isMediaManagerMember(interaction.member)) {
    return interaction.reply({ content: 'Por ahora, solo Media Manager puede transferir tickets.', ephemeral: true });
  }
  const ticket = getTicket(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'No encontré datos de este ticket.', ephemeral: true });

  return interaction.reply({
    content: '¿Cómo quieres transferir la visibilidad de este ticket? Solo una opción puede estar activa a la vez.',
    components: [transferChoiceRow()],
    ephemeral: true,
  });
}

async function resetTicketVisibility(channel) {
  for (const roleId of ticketStaffRoleIds()) {
    await channel.permissionOverwrites.delete(roleId).catch(() => {});
  }
  const ticket = getTicket(channel.id);
  const prevTarget = ticket?.visibility?.targetId;
  if (prevTarget) await channel.permissionOverwrites.delete(prevTarget).catch(() => {});
}

async function grantVisibility(channel, targetId) {
  await channel.permissionOverwrites.edit(targetId, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true,
  }).catch(() => {});
}

async function handleTransferPick(interaction) {
  if (!isMediaManagerMember(interaction.member)) {
    return interaction.update({ content: 'Por ahora, solo Media Manager puede transferir tickets.', components: [] });
  }
  const mode = interaction.customId.split(':')[1];

  if (mode === 'category') {

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_transfer_category_select')
        .setPlaceholder('Elige la categoría…')
        .addOptions({ label: 'Media Manager', value: 'media_manager', emoji: '🏷️' })
    );
    return interaction.update({ content: 'Elige la categoría que podrá ver este ticket:', components: [row] });
  }

  if (mode === 'role') {
    const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('ticket_transfer_role_select').setMinValues(1).setMaxValues(1));
    return interaction.update({ content: 'Elige el rol que podrá ver este ticket:', components: [row] });
  }

  if (mode === 'person') {
    const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('ticket_transfer_person_select').setMinValues(1).setMaxValues(1));
    return interaction.update({ content: 'Elige a la persona que podrá ver este ticket:', components: [row] });
  }
}

async function handleTransferCategorySelect(interaction) {
  if (!isMediaManagerMember(interaction.member)) {
    return interaction.update({ content: 'Por ahora, solo Media Manager puede transferir tickets.', components: [] });
  }
  const choice = interaction.values[0];
  const config = getConfig();

  if (choice === 'media_manager') {
    const roleId = config.mediaManagerRoleId;
    if (!roleId) {
      return interaction.update({ content: '⚠️ No hay `mediaManagerRoleId` configurado, así que no puedo aplicar este modo sin dejar el ticket sin nadie que lo vea. Configúralo primero.', components: [] });
    }
    await resetTicketVisibility(interaction.channel);
    await grantVisibility(interaction.channel, roleId);
    const renamed = await interaction.channel.setName('ver-mediamanager').then(() => true).catch(() => false);
    updateTicket(interaction.channel.id, { visibility: { mode: 'category', targetId: roleId, targetLabel: 'Media Manager' } });

    await interaction.channel.send({ content: `🏷️ Este ticket ahora solo lo puede ver **Media Manager** (transferido por <@${interaction.user.id}>).` });
    return interaction.update({
      content: `✅ Ahora solo Media Manager puede ver este ticket.${renamed ? '' : ' (El canal no se pudo renombrar todavía - Discord limita los cambios de nombre a 2 cada 10 minutos por canal, se aplicará más tarde.)'}`,
      components: [],
    });
  }

  return interaction.update({ content: 'Categoría no reconocida.', components: [] });
}

async function handleTransferRoleSelect(interaction) {
  if (!isMediaManagerMember(interaction.member)) {
    return interaction.update({ content: 'Por ahora, solo Media Manager puede transferir tickets.', components: [] });
  }
  const role = interaction.roles?.first?.() || interaction.values?.[0];
  const roleId = role?.id || role;
  const roleName = role?.name || roleId;

  await resetTicketVisibility(interaction.channel);
  await grantVisibility(interaction.channel, roleId);
  const renamed = await interaction.channel.setName(`ver-${slugify(roleName)}`).then(() => true).catch(() => false);
  updateTicket(interaction.channel.id, { visibility: { mode: 'role', targetId: roleId, targetLabel: roleName } });

  await interaction.channel.send({ content: `🏷️ Este ticket ahora solo lo puede ver <@&${roleId}> (transferido por <@${interaction.user.id}>).` });
  return interaction.update({
    content: `✅ Ahora solo <@&${roleId}> puede ver este ticket.${renamed ? '' : ' (El nombre del canal se actualizará más tarde: Discord limita los renombrados a 2 cada 10 minutos.)'}`,
    components: [],
  });
}

async function handleTransferPersonSelect(interaction) {
  if (!isMediaManagerMember(interaction.member)) {
    return interaction.update({ content: 'Por ahora, solo Media Manager puede transferir tickets.', components: [] });
  }
  const member = interaction.members?.first?.() || null;
  const user = interaction.users?.first?.() || member?.user;
  const targetId = user?.id || interaction.values?.[0];
  const targetLabel = member?.displayName || user?.username || targetId;

  await resetTicketVisibility(interaction.channel);
  await grantVisibility(interaction.channel, targetId);
  const renamed = await interaction.channel.setName(`ver-${slugify(targetLabel)}`).then(() => true).catch(() => false);
  updateTicket(interaction.channel.id, { claimedBy: targetId, visibility: { mode: 'person', targetId, targetLabel } });

  const claimMessage = await interaction.channel.messages.fetch({ limit: 20 })
    .then((msgs) => msgs.find((m) => m.components?.[0]?.components?.some((c) => c.customId === 'ticket_claim')))
    .catch(() => null);
  if (claimMessage && user) await claimMessage.edit({ components: [ticketActionRow(false, user.username)] }).catch(() => {});

  await interaction.channel.send({ content: `🔄 Este ticket ahora solo lo puede ver <@${targetId}> (transferido por <@${interaction.user.id}>).` });
  return interaction.update({
    content: `✅ Transferido a <@${targetId}>.${renamed ? '' : ' (El nombre del canal se actualizará más tarde: Discord limita los renombrados a 2 cada 10 minutos.)'}`,
    components: [],
  });
}

async function handleClose(interaction) {
  if (!isTicketStaff(interaction.member)) {
    return interaction.reply({ content: 'Solo el staff puede cerrar tickets.', ephemeral: true });
  }
  const ticket = getTicket(interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'No encontré datos de este ticket.', ephemeral: true });

  await interaction.deferUpdate();
  updateTicket(interaction.channel.id, { closedBy: interaction.user.id, closedAt: Date.now() });
  await interaction.message.edit({ components: [ticketActionRow(true)] }).catch(() => {});
  await interaction.channel.send({ content: '🔒 Ticket cerrado. Generando transcript… el canal se borrará en 20 segundos.' });

  await finalizeTicketClose(interaction.client, interaction.channel, interaction.channel.id, interaction.user.id);
}

async function finalizeTicketClose(client, channel, channelId, closedByUserId) {
  setTimeout(async () => {
    try {
      const ticket = getTicket(channelId);
      const guild = channel.guild;

      const allMessages = [];
      let lastId;

      while (true) {
        const batch = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) }).catch(() => null);
        if (!batch || batch.size === 0) break;
        allMessages.push(...batch.values());
        lastId = batch.last().id;
        if (batch.size < 100) break;
      }
      allMessages.reverse();

      const html = generateTicketTranscript({ guild, channel, messages: allMessages });
      const transcriptBuffer = Buffer.from(html, 'utf-8');
      const transcriptFile = { attachment: transcriptBuffer, name: `transcript-${channel.name}.html` };

      if (ticket?.userId) {
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        if (user) {

          const infoEmbed = new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setTitle('🔒 Tu ticket fue cerrado')
            .addFields(
              { name: 'Creado por', value: `<@${ticket.userId}>`, inline: true },
              { name: 'Cerrado por', value: `<@${closedByUserId}>`, inline: true },
              { name: 'Reclamado por', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Nadie', inline: true },
              { name: 'Creado', value: ticket.createdAt ? `<t:${Math.floor(ticket.createdAt / 1000)}:F>` : '-', inline: true },
              { name: 'Cerrado', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setTimestamp();
          await user.send({ embeds: [infoEmbed] }).catch(() => {});

          saveClosedSnapshot(channelId, {
            closedBy: closedByUserId,
            claimedBy: ticket.claimedBy,
            createdAt: ticket.createdAt,
            closedAt: Date.now(),
            userId: ticket.userId,
          });

          const ratingEmbed = new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setDescription(
              `Si pudieras valorar la atención de ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'nuestro equipo'} del 1 al 5:\n\n` +
              '**1** (mala) - **5** (muy buena)'
            );
          const ratingRow = new ActionRowBuilder().addComponents(
            [1, 2, 3, 4, 5].map((n) =>
              new ButtonBuilder().setCustomId(`ticket_rating_${n}_${channelId}`).setLabel('⭐'.repeat(n)).setStyle(ButtonStyle.Secondary)
            )
          );
          const ratingMsg = await user.send({ embeds: [ratingEmbed], components: [ratingRow] }).catch(() => null);
          if (ratingMsg) setRatingMessageRef(ticket.userId, channelId, { channelId: ratingMsg.channel.id, messageId: ratingMsg.id });

          await user.send({
            content: 'Aquí tienes el historial completo de la conversación.',
            files: [transcriptFile],
          }).catch(() => {});
        }
      }

      const config = getConfig();
      const closeLogChannelId = config.tickets?.closeLogChannelId;
      if (closeLogChannelId) {
        const answerFields = Object.entries(ticket?.answers || {}).map(([key, value]) => ({
          name: key === 'ign' ? 'Nick de Minecraft' : key === 'reported_ign' ? 'Media reportado' : key === 'motivo' ? 'Motivo' : key === 'reason' ? 'Razón del reporte' : key,
          value: value || '-',
          inline: false,
        }));
        const closeEmbed = new EmbedBuilder()
          .setColor(0xe0567b)
          .setTitle('🔒 Ticket cerrado')
          .addFields(
            { name: 'Creado por', value: ticket?.userId ? `<@${ticket.userId}>` : '-', inline: true },
            { name: 'Categoría', value: CATEGORY_LABELS[ticket?.category] || ticket?.category || '-', inline: true },
            { name: 'Mensajes', value: String(allMessages.length), inline: true },
            { name: 'Reclamado por', value: ticket?.claimedBy ? `<@${ticket.claimedBy}>` : 'Nadie', inline: true },
            { name: 'Cerrado por', value: `<@${closedByUserId}>`, inline: true },
            ...answerFields,
          )
          .setTimestamp();

        const closeLogChannel = await client.channels.fetch(closeLogChannelId).catch(() => null);
        if (closeLogChannel?.isTextBased()) {
          await closeLogChannel.send({ embeds: [closeEmbed], files: [transcriptFile] }).catch(() => {});
        }
      }

      removeTicket(channelId);
      await channel.delete().catch(() => {});
    } catch (err) {
      console.error('[tickets] error al finalizar el cierre:', err.message);
    }
  }, 20 * 1000);
}

function buildFeedbackModal() {
  return new ModalBuilder()
    .setCustomId('ticket_modal_feedback')
    .setTitle('Valoración del ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('comments').setLabel('Comentarios (opcional)')
          .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)
      )
    );
}

async function handleTicketRating(interaction) {
  const parts = interaction.customId.split('_');
  const stars = parseInt(parts[2], 10);
  const ticketId = parts.slice(3).join('_');

  if (hasRated(interaction.user.id, ticketId)) {
    return interaction.reply({ content: 'Ya valoraste este ticket.', ephemeral: true });
  }

  setPendingRating(interaction.user.id, { stars, ticketId });
  return interaction.showModal(buildFeedbackModal());
}

async function handleFeedbackModalSubmit(interaction) {
  const userId = interaction.user.id;
  const comments = interaction.fields.getTextInputValue('comments') || '';
  const pending = getPendingRating(userId);

  if (!pending) {
    return interaction.reply({ content: 'La valoración expiró, no pasa nada - gracias igualmente.', ephemeral: true });
  }

  await interaction.reply({ content: '¡Gracias por tu valoración! Nos ayuda a mejorar 💙', ephemeral: true });

  const { stars, ticketId } = pending;
  const starStr = '⭐'.repeat(stars);
  const closed = getClosedSnapshot(ticketId) || {};

  const config = getConfig();
  const classificationChannelId = config.tickets?.classificationChannelId;
  if (classificationChannelId) {
    const feedbackEmbed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('⭐ Valoración de ticket')
      .addFields(
        { name: 'Usuario', value: `<@${userId}>`, inline: true },
        { name: 'Cerrado por', value: closed.closedBy ? `<@${closed.closedBy}>` : 'Desconocido', inline: true },
        { name: 'Reclamado por', value: closed.claimedBy ? `<@${closed.claimedBy}>` : 'Nadie', inline: true },
        { name: 'Creado', value: closed.createdAt ? `<t:${Math.floor(closed.createdAt / 1000)}:F>` : '-', inline: true },
        { name: 'Cerrado', value: closed.closedAt ? `<t:${Math.floor(closed.closedAt / 1000)}:F>` : '-', inline: true },
        { name: 'Valoración', value: `${starStr} (${stars}/5)`, inline: false },
        { name: 'Comentarios', value: comments || 'Sin comentarios', inline: false },
      )
      .setTimestamp();

    const channel = await interaction.client.channels.fetch(classificationChannelId).catch(() => null);
    if (channel?.isTextBased()) await channel.send({ embeds: [feedbackEmbed] }).catch(() => {});
  }

  const msgRef = getRatingMessageRef(userId, ticketId);
  if (msgRef) {
    const dmChannel = await interaction.client.channels.fetch(msgRef.channelId).catch(() => null);
    const msg = await dmChannel?.messages.fetch(msgRef.messageId).catch(() => null);
    if (msg) await msg.edit({ components: [] }).catch(() => {});
    clearRatingMessageRef(userId, ticketId);
  }

  markRated(userId, ticketId);
  clearPendingRating(userId);
}

module.exports = {
  isTicketStaff,
  isMediaManagerMember,
  slugify,
  handlePanelSelect,
  handleModalSubmit,
  handleClaim,
  handleClose,
  handleTransferButton,
  handleTransferPick,
  handleTransferCategorySelect,
  handleTransferRoleSelect,
  handleTransferPersonSelect,
  handleTicketRating,
  handleFeedbackModalSubmit,
  CATEGORY_LABELS,
};
