const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('./config');

async function sendLog(client, embed) {
  try {
    const { logChannelId } = getConfig();
    if (!logChannelId || logChannelId.startsWith('PON_AQUI')) {
      console.warn('[logger] logChannelId no configurado en config.json, log omitido.');
      return;
    }
    const channel = await client.channels.fetch(logChannelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[logger] No se pudo enviar el log:', err.message);
  }
}

async function logSubscriptionAdded(client, { staff, targetUser, platform, externalId, displayName, discordChannelId, expiresAt, renewed, roleKey, guild }) {
  const embed = new EmbedBuilder()
    .setColor(renewed ? 0x38bdf8 : 0x57f287)
    .setTitle(renewed ? '🔄 Media renovada' : '✅ Media creada')
    .addFields(
      { name: 'Staff', value: `<@${staff.id}> (\`${staff.id}\`)`, inline: true },
      { name: 'Media user', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
      { name: 'Rol asignado', value: roleKey || '-', inline: true },
      { name: 'Plataforma', value: platform, inline: true },
      { name: 'Canal de media', value: `${displayName} (\`${externalId}\`)`, inline: true },
      { name: 'Canal de notificación (discord)', value: `<#${discordChannelId}>`, inline: true },
      { name: 'Expira en', value: `<t:${Math.floor(expiresAt / 1000)}:F>`, inline: true },
      { name: 'Servidor donde se notifica', value: `${guild?.name ?? '-'} (\`${guild?.id ?? '-'}\`)` }
    )
    .setTimestamp();
  await sendLog(client, embed);
}

async function logRoleAssigned(client, { staff, targetUser, roleId, roleKey, guild }) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🏷️ Rol asignado (bot)')
    .addFields(
      { name: 'Staff responsable', value: `<@${staff.id}> (\`${staff.id}\`)`, inline: true },
      { name: 'Usuario', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
      { name: 'Rol', value: `<@&${roleId}> (${roleKey})`, inline: true },
      { name: 'Servidor', value: `${guild?.name ?? '-'} (\`${guild?.id ?? '-'}\`)` }
    )
    .setTimestamp();
  await sendLog(client, embed);
}

async function logRoleRemoved(client, { targetUserId, roleId, roleKey, guild, success, reason }) {
  const embed = new EmbedBuilder()
    .setColor(success ? 0xfee75c : 0xed4245)
    .setTitle(success ? '🏷️ Rol retirado (media caducada)' : '⚠️ No se pudo retirar el rol')
    .addFields(
      { name: 'Usuario', value: `<@${targetUserId}> (\`${targetUserId}\`)`, inline: true },
      { name: 'Rol', value: `<@&${roleId}> (${roleKey || '-'})`, inline: true },
      { name: 'Servidor', value: `${guild?.name ?? '-'} (\`${guild?.id ?? '-'}\`)`, inline: true }
    )
    .setTimestamp();
  if (!success && reason) embed.addFields({ name: 'Motivo', value: reason });
  await sendLog(client, embed);
}

async function logSubscriptionRemoved(client, { staff, platform, externalId, guild }) {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🗑️ Suscripción eliminada manualmente')
    .addFields(
      { name: 'Staff responsable', value: `<@${staff.id}> (\`${staff.id}\`)`, inline: true },
      { name: 'Plataforma', value: platform, inline: true },
      { name: 'Canal de media', value: `\`${externalId}\``, inline: true },
      { name: 'Servidor', value: `${guild?.name ?? '-'} (\`${guild?.id ?? '-'}\`)` }
    )
    .setTimestamp();
  await sendLog(client, embed);
}

async function logSubscriptionExpired(client, sub) {
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('⏰ Suscripción caducada')
    .setDescription('Han pasado los 14 días y esta suscripción se eliminó automáticamente.')
    .addFields(
      { name: 'Usuario asignado', value: sub.discordUserId ? `<@${sub.discordUserId}> (\`${sub.discordUserId}\`)` : 'Sin asignar', inline: true },
      { name: 'Rol que tenía', value: sub.roleKey ? `${sub.roleKey}` : '-', inline: true },
      { name: 'Plataforma', value: sub.platform, inline: true },
      { name: 'Canal de media', value: `${sub.displayName} (\`${sub.externalId}\`)`, inline: true },
      { name: 'Canal de notificación (discord)', value: `<#${sub.discordChannelId}>`, inline: true },
      { name: 'Fue añadida', value: `<t:${Math.floor(sub.addedAt / 1000)}:F>`, inline: true },
      { name: 'ID interno', value: `\`${sub.id}\`` }
    )
    .setTimestamp();
  await sendLog(client, embed);
}

async function logRenewalWarning(client, { sub, daysLeft, threshold }) {
  const embed = new EmbedBuilder()
    .setColor(threshold === 1 ? 0xffa94d : 0x38bdf8)
    .setTitle(threshold === 1 ? '⏳ Queda 1 día para renovar' : '⏳ Quedan 3 días para renovar')
    .addFields(
      { name: 'Usuario', value: sub.discordUserId ? `<@${sub.discordUserId}> (\`${sub.discordUserId}\`)` : 'Sin asignar', inline: true },
      { name: 'Plataforma', value: sub.platform, inline: true },
      { name: 'Rango', value: sub.roleKey || '-', inline: true },
      { name: 'Canal', value: `${sub.displayName} (\`${sub.externalId}\`)`, inline: false },
      { name: 'Expira', value: `<t:${Math.floor(sub.expiresAt / 1000)}:F>`, inline: false },
      { name: 'Restante', value: `Aprox. ${daysLeft} día(s)`, inline: true },
    )
    .setFooter({ text: 'RevenantMC · Renewal alert' })
    .setTimestamp();
  await sendLog(client, embed);
}

async function logNewUpload(client, { platform, type, sub, url, title, extra }) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📢 Nueva publicación detectada - ${platform.toUpperCase()}`)
    .addFields(
      { name: 'Tipo de notificación', value: type, inline: true },
      { name: 'Media user', value: `${sub.displayName} (\`${sub.externalId}\`)`, inline: true },
      { name: 'Media user (discord)', value: sub.discordUserId ? `<@${sub.discordUserId}>` : 'Sin asignar', inline: true },
      { name: 'Título', value: title || '-' },
      { name: 'URL', value: url },
      { name: 'Notificado en', value: `<#${sub.discordChannelId}>`, inline: true },
      { name: 'Detectado', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setTimestamp();
  if (extra) embed.addFields({ name: 'Info adicional', value: extra });
  await sendLog(client, embed);
}

async function logApplicationAccepted(client, { application, staff, platform, roleKey, subscription, assignedRoleId }) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Apply aceptada')
    .addFields(
      { name: 'Staff', value: `<@${staff.id}> (\`${staff.id}\`)`, inline: true },
      { name: 'Usuario', value: `<@${application.discordId}> (\`${application.discordId}\`)`, inline: true },
      { name: 'Rango solicitado', value: application.rank || '-', inline: true },
      { name: 'Plataforma detectada', value: platform || '-', inline: true },
      { name: 'Rol', value: roleKey || '-', inline: true },
      { name: 'Rol Discord', value: assignedRoleId ? `<@&${assignedRoleId}>` : '-', inline: true },
      { name: 'Auto-suscripción', value: subscription ? `Sí · ${subscription.id}` : 'No', inline: false },
      { name: 'ID apply', value: `\`${application.id}\`` }
    )
    .setTimestamp();
  await sendLog(client, embed);
}

async function logApplicationRejected(client, { application, staff, reason }) {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('❌ Apply rechazada')
    .addFields(
      { name: 'Staff', value: `<@${staff.id}> (\`${staff.id}\`)`, inline: true },
      { name: 'Usuario', value: `<@${application.discordId}> (\`${application.discordId}\`)`, inline: true },
      { name: 'Rango solicitado', value: application.rank || '-', inline: true },
      { name: 'ID apply', value: `\`${application.id}\`` },
      { name: 'Motivo', value: reason || 'Rechazada por el staff' }
    )
    .setTimestamp();
  await sendLog(client, embed);
}

module.exports = {
  logSubscriptionAdded,
  logSubscriptionRemoved,
  logSubscriptionExpired,
  logRenewalWarning,
  logNewUpload,
  logRoleAssigned,
  logRoleRemoved,
  logApplicationAccepted,
  logApplicationRejected,
};
