const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config.json');

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("Missing TOKEN in environment variables");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('createroles')
    .setDescription('Create a reaction role')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registering commands...');

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );

    console.log('Commands registered');
  } catch (err) {
    console.error(err);
  }
})();