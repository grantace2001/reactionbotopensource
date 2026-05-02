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

// ---------------- CLIENT ----------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

// ---------------- DATABASE ----------------

const DB_PATH = path.join(__dirname, 'database.json');

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error("❌ DB load error:", err);
    return [];
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ DB save error:", err);
  }
}

// ---------------- UTIL ----------------

function normalizeEmoji(emoji) {
  return emoji.id || emoji.name;
}

// ---------------- COMMAND ----------------

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== 'createroles') return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: "❌ Administrator permission required.",
      ephemeral: true
    });
  }

  await interaction.reply({
    content: "⚠️ Setup via chat questions is disabled in this rebuild.\nManually add entries to database.json.",
    ephemeral: true
  });
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

    // MODE HANDLING

    switch (config.mode) {
      case 1: // normal + DM
        await member.roles.add(role);
        await user.send(`You received ${role.name}`).catch(() => {});
        break;

      case 2: // sticky
        await member.roles.add(role);
        break;

      case 3: // double react (simplified)
        await member.roles.add(role);
        break;

      case 4: // silent
        await member.roles.add(role);
        break;
    }

  } catch (err) {
    console.error("❌ Reaction add error:", err);
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

    // sticky & double-react do NOT remove role
    if (config.mode === 2 || config.mode === 3) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(config.roleId);

    if (!role) return;

    await member.roles.remove(role);

  } catch (err) {
    console.error("❌ Reaction remove error:", err);
  }
});

// ---------------- READY ----------------

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---------------- START ----------------

client.login(TOKEN);