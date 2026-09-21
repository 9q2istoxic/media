const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('./auditLogger');
const { getConfig } = require('./config');

const COLOR = {
  create: 0x74c261,
  delete: 0xe0567b,
  update: 0xf2a43a,
  info: 0x8b5cf6,
  mod: 0xe0567b,
};

function base(color, title) {
  return new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
}

function truncate(s, n = 1000) {
  if (!s) return '-';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function isTicketChannelByAttrs(parentId, name) {
  const config = getConfig();
  const ticketCategoryId = config.tickets?.categoryId;
  if (ticketCategoryId && parentId === ticketCategoryId) return true;
  return /^(ticket-|ver-|media-apply-)/.test(name || '');
}

function isTicketRelatedChannel(entry) {
  return isTicketChannelByAttrs(entry.target?.parentId, entry.target?.name);
}

function registerLogHandlers(client) {

  client.on('guildAuditLogEntryCreate', async (entry, guild) => {
    try {
      const executor = entry.executorId ? `<@${entry.executorId}>` : 'Desconocido';

      switch (entry.action) {
        case AuditLogEvent.InviteCreate: {
          const code = entry.target?.code || entry.changes?.find((c) => c.key === 'code')?.new;
          const embed = base(COLOR.create, '🔗 Invitación creada')
            .setDescription(`**Código:** ${code || '-'}\n**Creada por:** ${executor}`);
          await sendLog(client, 'invites', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.InviteDelete: {
          const code = entry.target?.code || entry.changes?.find((c) => c.key === 'code')?.old;
          const embed = base(COLOR.delete, '🔗 Invitación eliminada')
            .setDescription(`**Código:** ${code || '-'}\n**Eliminada por:** ${executor}`);
          await sendLog(client, 'invites', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.ChannelCreate: {
          if (isTicketRelatedChannel(entry)) break;
          const embed = base(COLOR.create, '📁 Canal creado')
            .setDescription(`**Canal:** ${entry.target?.name || entry.targetId}\n**Por:** ${executor}`);
          await sendLog(client, 'channelCreateDelete', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.ChannelDelete: {
          if (isTicketRelatedChannel(entry)) break;
          const embed = base(COLOR.delete, '📁 Canal eliminado')
            .setDescription(`**Canal:** ${entry.target?.name || entry.targetId}\n**Por:** ${executor}`);
          await sendLog(client, 'channelCreateDelete', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.ChannelUpdate: {
          const changesText = (entry.changes || [])
            .map((c) => `**${c.key}:** ${truncate(String(c.old ?? '-'), 100)} → ${truncate(String(c.new ?? '-'), 100)}`)
            .join('\n') || 'Sin detalle';
          const embed = base(COLOR.update, '📁 Canal editado')
            .setDescription(`**Canal:** <#${entry.targetId}>\n**Por:** ${executor}\n\n${changesText}`);
          await sendLog(client, 'channelUpdate', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.RoleCreate: {
          const embed = base(COLOR.create, '🎭 Rol creado')
            .setDescription(`**Rol:** ${entry.target?.name || entry.targetId}\n**Por:** ${executor}`);
          await sendLog(client, 'roleCreateDelete', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.RoleDelete: {
          const embed = base(COLOR.delete, '🎭 Rol eliminado')
            .setDescription(`**Rol:** ${entry.target?.name || entry.targetId}\n**Por:** ${executor}`);
          await sendLog(client, 'roleCreateDelete', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.RoleUpdate: {
          const changesText = (entry.changes || [])
            .map((c) => `**${c.key}:** ${truncate(String(c.old ?? '-'), 100)} → ${truncate(String(c.new ?? '-'), 100)}`)
            .join('\n') || 'Sin detalle';
          const embed = base(COLOR.update, '🎭 Rol editado')
            .setDescription(`**Rol:** <@&${entry.targetId}>\n**Por:** ${executor}\n\n${changesText}`);
          await sendLog(client, 'roleUpdate', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.GuildUpdate: {
          const changesText = (entry.changes || [])
            .map((c) => `**${c.key}:** ${truncate(String(c.old ?? '-'), 100)} → ${truncate(String(c.new ?? '-'), 100)}`)
            .join('\n') || 'Sin detalle';
          const embed = base(COLOR.update, '🛠️ Servidor actualizado')
            .setDescription(`**Por:** ${executor}\n\n${changesText}`);
          await sendLog(client, 'guildUpdate', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.MemberBanAdd: {
          const embed = base(COLOR.mod, '🔨 Miembro baneado')
            .setDescription(`**Usuario:** <@${entry.targetId}> (\`${entry.targetId}\`)\n**Por:** ${executor}\n**Motivo:** ${entry.reason || 'Sin motivo'}`);
          await sendLog(client, 'bans', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.MemberBanRemove: {
          const embed = base(COLOR.create, '🔓 Miembro desbaneado')
            .setDescription(`**Usuario:** <@${entry.targetId}> (\`${entry.targetId}\`)\n**Por:** ${executor}`);
          await sendLog(client, 'bans', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.MemberKick: {
          const embed = base(COLOR.mod, '👢 Miembro expulsado')
            .setDescription(`**Usuario:** <@${entry.targetId}> (\`${entry.targetId}\`)\n**Por:** ${executor}\n**Motivo:** ${entry.reason || 'Sin motivo'}`);
          await sendLog(client, 'kicks', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.MessageBulkDelete: {
          const count = entry.extra?.count ?? '-';
          const embed = base(COLOR.mod, '🧹 Limpieza de mensajes (purge)')
            .setDescription(`**Canal:** <#${entry.targetId}>\n**Mensajes borrados:** ${count}\n**Por:** ${executor}`);
          await sendLog(client, 'purge', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.MessagePin: {
          const embed = base(COLOR.info, '📌 Mensaje fijado')
            .setDescription(`**Canal:** <#${entry.extra?.channel?.id || '-'}>\n**Por:** ${executor}`);
          await sendLog(client, 'messagePin', { embeds: [embed] });
          break;
        }
        case AuditLogEvent.MessageUnpin: {
          const embed = base(COLOR.info, '📌 Mensaje desanclado')
            .setDescription(`**Canal:** <#${entry.extra?.channel?.id || '-'}>\n**Por:** ${executor}`);
          await sendLog(client, 'messagePin', { embeds: [embed] });
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error('[logs][auditLogEntry]', err.message);
    }
  });

  client.on('guildMemberAdd', async (member) => {
    const ageMs = Date.now() - member.user.createdTimestamp;
    const ageDays = Math.floor(ageMs / 86400000);
    const embed = base(COLOR.create, '📥 Nuevo miembro')
      .setDescription(`**Usuario:** <@${member.id}> (\`${member.id}\`)\n**Cuenta creada hace:** ${ageDays} días`)
      .setThumbnail(member.user.displayAvatarURL());
    await sendLog(client, 'memberJoin', { embeds: [embed] });
  });

  client.on('guildMemberRemove', async (member) => {
    const embed = base(COLOR.delete, '📤 Miembro se fue')
      .setDescription(`**Usuario:** ${member.user?.tag || member.id} (\`${member.id}\`)`)
      .setThumbnail(member.user?.displayAvatarURL?.() || null);
    await sendLog(client, 'memberLeave', { embeds: [embed] });
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.nickname !== newMember.nickname) {
      const embed = base(COLOR.update, '✏️ Apodo cambiado')
        .setDescription(`**Usuario:** <@${newMember.id}>\n**Antes:** ${oldMember.nickname || '-'}\n**Ahora:** ${newMember.nickname || '-'}`);
      await sendLog(client, 'profileUpdate', { embeds: [embed] });
    }

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const added = newRoles.filter((r) => !oldRoles.has(r.id));
    const removed = oldRoles.filter((r) => !newRoles.has(r.id));
    if (added.size || removed.size) {
      const parts = [];
      if (added.size) parts.push(`**Añadidos:** ${added.map((r) => `<@&${r.id}>`).join(', ')}`);
      if (removed.size) parts.push(`**Quitados:** ${removed.map((r) => `<@&${r.id}>`).join(', ')}`);
      const embed = base(COLOR.update, '🎭 Roles de miembro actualizados')
        .setDescription(`**Usuario:** <@${newMember.id}>\n${parts.join('\n')}`);
      await sendLog(client, 'memberRoleUpdate', { embeds: [embed] });
    }

    const oldUntil = oldMember.communicationDisabledUntilTimestamp;
    const newUntil = newMember.communicationDisabledUntilTimestamp;
    if (oldUntil !== newUntil) {
      if (newUntil && newUntil > Date.now()) {
        const embed = base(COLOR.mod, '🔇 Miembro silenciado (timeout)')
          .setDescription(`**Usuario:** <@${newMember.id}>\n**Termina:** <t:${Math.floor(newUntil / 1000)}:F>`);
        await sendLog(client, 'timeouts', { embeds: [embed] });
      } else if (oldUntil && (!newUntil || newUntil <= Date.now())) {
        const embed = base(COLOR.create, '🔊 Timeout levantado')
          .setDescription(`**Usuario:** <@${newMember.id}>`);
        await sendLog(client, 'timeouts', { embeds: [embed] });
      }
    }
  });

  client.on('userUpdate', async (oldUser, newUser) => {
    if (oldUser.avatar === newUser.avatar && oldUser.username === newUser.username) return;
    const embed = base(COLOR.update, '🖼️ Perfil de usuario actualizado')
      .setDescription(`**Usuario:** <@${newUser.id}>${oldUser.username !== newUser.username ? `\n**Nombre:** ${oldUser.username} → ${newUser.username}` : ''}`)
      .setThumbnail(newUser.displayAvatarURL());
    await sendLog(client, 'profileUpdate', { embeds: [embed] });
  });

  client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member) return;

    if (!oldState.channelId && newState.channelId) {
      const embed = base(COLOR.create, '🔊 Se conectó a voz')
        .setDescription(`**Usuario:** <@${member.id}>\n**Canal:** <#${newState.channelId}>`);
      await sendLog(client, 'voiceJoinLeave', { embeds: [embed] });
    } else if (oldState.channelId && !newState.channelId) {
      const embed = base(COLOR.delete, '🔇 Se desconectó de voz')
        .setDescription(`**Usuario:** <@${member.id}>\n**Canal:** <#${oldState.channelId}>`);
      await sendLog(client, 'voiceJoinLeave', { embeds: [embed] });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const embed = base(COLOR.update, '🔀 Cambió de canal de voz')
        .setDescription(`**Usuario:** <@${member.id}>\n**De:** <#${oldState.channelId}>\n**A:** <#${newState.channelId}>`);
      await sendLog(client, 'voiceMove', { embeds: [embed] });
    }
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (newMessage.author?.bot) return;
    if (oldMessage.partial || newMessage.partial) return;
    if (oldMessage.content === newMessage.content) return;
    if (isTicketChannelByAttrs(newMessage.channel?.parentId, newMessage.channel?.name)) return;
    const embed = base(COLOR.update, '✏️ Mensaje editado')
      .setDescription(`**Autor:** <@${newMessage.author?.id}>\n**Canal:** <#${newMessage.channelId}>`)
      .addFields(
        { name: 'Antes', value: truncate(oldMessage.content, 1000) },
        { name: 'Ahora', value: truncate(newMessage.content, 1000) }
      );
    await sendLog(client, 'messageEdit', { embeds: [embed] });
  });

  client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;
    if (message.partial) return;
    if (isTicketChannelByAttrs(message.channel?.parentId, message.channel?.name)) return;
    const embed = base(COLOR.delete, '🗑️ Mensaje eliminado')
      .setDescription(`**Autor:** ${message.author ? `<@${message.author.id}>` : 'Desconocido'}\n**Canal:** <#${message.channelId}>`)
      .addFields({ name: 'Contenido', value: truncate(message.content, 1500) });
    await sendLog(client, 'messageDelete', { embeds: [embed] });
  });

  client.on('messageDeleteBulk', async (messages, channel) => {
    if (isTicketChannelByAttrs(channel?.parentId, channel?.name)) return;
    const embed = base(COLOR.mod, '🧹 Limpieza de mensajes (purge)')
      .setDescription(`**Canal:** <#${channel?.id}>\n**Mensajes borrados:** ${messages.size}`);
    await sendLog(client, 'purge', { embeds: [embed] });
  });
}

module.exports = { registerLogHandlers, isTicketRelatedChannel, isTicketChannelByAttrs };
