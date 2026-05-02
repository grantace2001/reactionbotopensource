require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField
} = require('discord.js');

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

const DB_PATH = path.join(__dirname, 'database.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function normalizeEmoji(emoji) {
  return emoji.id || emoji.name;
}

// ---------------- COMMAND ----------------

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== 'createroles') return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: "❌ Administrator required.",
      ephemeral: true
    });
  }

  try {
    const role = interaction.options.getRole('role');
    const channel = interaction.options.getChannel('channel');
    const messageId = interaction.options.getString('message_id');
    const emoji = interaction.options.getString('emoji');
    const mode = interaction.options.getInteger('mode');

    // Validate mode
    if (![1,2,3,4].includes(mode)) {
      return interaction.reply({
        content: "❌ Mode must be 1-4.",
        ephemeral: true
      });
    }

    // Fetch message
    const targetChannel = await client.channels.fetch(channel.id);
    const targetMessage = await targetChannel.messages.fetch(messageId);

    // Save to DB
    const db = loadDB();

    db.push({
      roleId: role.id,
      channelId: channel.id,
      messageId: messageId,
      emoji: emoji,
      mode: mode
    });

    saveDB(db);

    // React
    await targetMessage.react(emoji);

    await interaction.reply({
      content: "✅ Reaction role created successfully.",
      ephemeral: true
    });

  } catch (err) {
    console.error(err);

    await interaction.reply({
      content: "❌ Failed. Check message ID, emoji, and permissions.",
      ephemeral: true
    });
  }
});

// ---------------- REACTION ADD ----------------

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const db = loadDB();

    const config = db.find(c =>
      c.messageId === reaction.message.id &&
      c.emoji === normalizeEmoji(reaction.emoji)
    );

    if (!config) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(config.roleId);

    if (!role) return;

    switch (config.mode) {
      case 1:
        await member.roles.add(role);
        await user.send(`You received ${role.name}`).catch(() => {});
        break;
      case 2:
        await member.roles.add(role);
        break;
      case 3:
        await member.roles.add(role);
        break;
      case 4:
        await member.roles.add(role);
        break;
    }

  } catch (err) {
    console.error("Reaction add error:", err);
  }
});

// ---------------- REACTION REMOVE ----------------

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const db = loadDB();

    const config = db.find(c =>
      c.messageId === reaction.message.id &&
      c.emoji === normalizeEmoji(reaction.emoji)
    );

    if (!config) return;

    if (config.mode === 2 || config.mode === 3) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(config.roleId);

    if (!role) return;

    await member.roles.remove(role);

  } catch (err) {
    console.error("Reaction remove error:", err);
  }
});

// ---------------- READY ----------------

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);