require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  try {
    const command = require(path.join(commandsPath, file));
    if (!command?.data?.toJSON) {
      console.error(`⚠️  ${file} no exporta { data } correctamente, se omite.`);
      continue;
    }
    commands.push(command.data.toJSON());
  } catch (err) {
    console.error(`⚠️  No se pudo cargar ${file}, se omite: ${err.message}`);
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

    console.log(`Registrando ${commands.length} comandos...`);
    await rest.put(route, { body: commands });
    console.log('✅ Comandos registrados correctamente.');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
})();
