require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config.json');

const commands = [
  new SlashCommandBuilder()
    .setName('createroles')
    .setDescription('Create a reaction role')
    .addRoleOption(option =>
      option.setName('role').setDescription('Role to assign').setRequired(true))
    .addChannelOption(option =>
      option.setName('channel').setDescription('Target channel').setRequired(true))
    .addStringOption(option =>
      option.setName('message_id').setDescription('Message ID').setRequired(true))
    .addStringOption(option =>
      option.setName('emoji').setDescription('Emoji (unicode or custom)').setRequired(true))
    .addIntegerOption(option =>
      option.setName('mode')
        .setDescription('1=normal, 2=sticky, 3=double, 4=silent')
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );
  console.log("✅ Commands deployed");
})();