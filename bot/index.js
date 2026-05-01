
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  Partials
} = require('discord.js');

// RENDER ENV (no .env file anymore)
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("Missing TOKEN in environment variables");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// DB helpers
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync('./database.json', 'utf8'));
  } catch {
    return [];
  }
}

function saveDB(data) {
  fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));
}

// Ask helper
async function askQuestion(channel, user, question) {
  await channel.send(question);

  const filter = m => m.author.id === user.id;

  const collected = await channel.awaitMessages({
    filter,
    max: 1,
    time: 60000
  });

  if (!collected.size) throw new Error("Timed out");

  return collected.first().content;
}

// Slash command
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'createroles') {
    await interaction.reply({ content: 'Starting setup...', ephemeral: true });

    const channel = interaction.channel;
    const user = interaction.user;

    try {
      const roleInput = await askQuestion(channel, user, "Mention the role:");
      const roleId = roleInput.replace(/\D/g, '');

      const channelId = await askQuestion(channel, user, "Enter channel ID:");
      const messageId = await askQuestion(channel, user, "Enter message ID:");
      const emoji = await askQuestion(channel, user, "Send the emoji:");
      const mode = await askQuestion(channel, user, "Mode (1-4):");
      const color = await askQuestion(channel, user, "Color (1-10):");

      const db = loadDB();

      db.push({
        roleId,
        channelId,
        messageId,
        emoji,
        mode: Number(mode),
        color: Number(color)
      });

      saveDB(db);

      const targetChannel = await client.channels.fetch(channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);

      await targetMessage.react(emoji);

      channel.send("✅ Reaction role created!");

    } catch {
      channel.send("❌ Setup failed or timed out.");
    }
  }
});

// Reaction add
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  const db = loadDB();

  const config = db.find(c =>
    c.messageId === reaction.message.id &&
    c.emoji === reaction.emoji.name
  );

  if (!config) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(config.roleId);

  if (!role) return;

  if (config.mode === 1 || config.mode === 4) {
    await member.roles.add(role);
    if (config.mode === 1) user.send(`You received ${role.name}`);
  }

  if (config.mode === 2) {
    await member.roles.add(role);
    user.send(`Sticky role applied: ${role.name}`);
  }

  if (config.mode === 3) {
    if (!reaction.message._doubleReact) reaction.message._doubleReact = {};

    const key = `${user.id}-${config.messageId}`;

    if (!reaction.message._doubleReact[key]) {
      reaction.message._doubleReact[key] = Date.now();
      await reaction.users.remove(user.id);
      return;
    }

    const timeDiff = Date.now() - reaction.message._doubleReact[key];

    if (timeDiff < 5000) {
      await member.roles.add(role);
      user.send(`Double react success: ${role.name}`);
    }

    delete reaction.message._doubleReact[key];
  }
});

// Reaction remove
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  const db = loadDB();

  const config = db.find(c =>
    c.messageId === reaction.message.id &&
    c.emoji === reaction.emoji.name
  );

  if (!config) return;
  if (config.mode === 2 || config.mode === 3) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(config.roleId);

  if (!role) return;

  await member.roles.remove(role);
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);