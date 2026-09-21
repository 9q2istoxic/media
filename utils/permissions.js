const { getConfig } = require('./config');

function isAdmin(interaction) {
  const config = getConfig();
  const roleId = config.adminRoleId;

  if (!roleId || roleId.startsWith('PON_AQUI')) {
    console.warn('[permissions] adminRoleId no está configurado en config.json - bloqueando por seguridad.');
    return false;
  }

  return interaction.member?.roles?.cache?.has(roleId) ?? false;
}

async function denyIfNotAdmin(interaction) {
  if (isAdmin(interaction)) return false;

  await interaction.reply({
    content: '🚫 No tienes el rol necesario para usar este comando.',
    ephemeral: true,
  });
  return true;
}

module.exports = { isAdmin, denyIfNotAdmin };
