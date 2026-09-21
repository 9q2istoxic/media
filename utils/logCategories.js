
const LOG_CATEGORIES = [
  { id: 'invites', label: 'Invitaciones', group: 'Servidor', desc: 'Creación y eliminación de invitaciones.' },
  { id: 'voiceJoinLeave', label: 'Conexión/Desconexión de voz', group: 'Voz', desc: 'Usuarios que entran o salen de un canal de voz.' },
  { id: 'voiceMove', label: 'Cambio de canal de voz', group: 'Voz', desc: 'Usuarios que se mueven de un canal de voz a otro.' },
  { id: 'channelCreateDelete', label: 'Canales creados/eliminados', group: 'Servidor', desc: 'Canales de texto, voz o categorías nuevas y borradas.' },
  { id: 'channelUpdate', label: 'Canales editados', group: 'Servidor', desc: 'Cambios de nombre, topic, slowmode o permisos.' },
  { id: 'roleCreateDelete', label: 'Roles creados/eliminados', group: 'Servidor', desc: 'Roles nuevos creados o eliminados.' },
  { id: 'roleUpdate', label: 'Roles editados', group: 'Servidor', desc: 'Cambios en nombre, color o permisos de un rol.' },
  { id: 'guildUpdate', label: 'Actualizaciones del servidor', group: 'Servidor', desc: 'Nombre, icono, región o nivel de verificación.' },
  { id: 'memberJoin', label: 'Ingresos (Joins)', group: 'Miembros', desc: 'Nuevos usuarios que entran al servidor.' },
  { id: 'memberLeave', label: 'Salidas (Leaves)', group: 'Miembros', desc: 'Usuarios que abandonan el servidor.' },
  { id: 'profileUpdate', label: 'Cambios de perfil', group: 'Miembros', desc: 'Apodo, avatar o banner.' },
  { id: 'memberRoleUpdate', label: 'Roles de miembro', group: 'Miembros', desc: 'Roles añadidos o quitados a un miembro.' },
  { id: 'messageEdit', label: 'Mensajes editados', group: 'Mensajes', desc: 'Contenido antiguo y nuevo.' },
  { id: 'messageDelete', label: 'Mensajes eliminados', group: 'Mensajes', desc: 'Contenido, autor y canal.' },
  { id: 'messagePin', label: 'Mensajes fijados', group: 'Mensajes', desc: 'Mensajes anclados o desanclados.' },
  { id: 'purge', label: 'Limpieza de canales (Purge)', group: 'Mensajes', desc: 'Borrado masivo: cuántos y en qué canal.' },
  { id: 'bans', label: 'Baneos', group: 'Moderación', desc: 'Miembros baneados y desbaneados.' },
  { id: 'kicks', label: 'Expulsiones (Kicks)', group: 'Moderación', desc: 'Miembros expulsados.' },
  { id: 'timeouts', label: 'Sanciones temporales (Timeouts)', group: 'Moderación', desc: 'Silenciados/aislados y cuándo termina.' },
  { id: 'warns', label: 'Advertencias (Warns)', group: 'Moderación', desc: 'Sistema interno de avisos del bot.' },
];

function findCategory(id) {
  return LOG_CATEGORIES.find((c) => c.id === id) || null;
}

module.exports = { LOG_CATEGORIES, findCategory };
