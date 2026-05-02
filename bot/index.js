const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField
} = require('discord.js');

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
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

// ---------------- DB ----------------

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync('./database.json', 'utf8'));
  } catch (err) {
    console.error("DB load error:", err);
    return [];
  }
}

function saveDB(data) {
  fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));
}

// ---------------- ASK FUNCTION ----------------

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

// ---------------- COMMAND ----------------

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'createroles') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: "❌ You need Administrator permission to use this command.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    const user = interaction.user;

    try {
      const roleInput = await askQuestion(channel, user, "Mention the role:");
      const roleId = roleInput.replace(/\D/g, '');

      const channelId = await askQuestion(channel, user, "Enter channel ID:");
      const messageId = await askQuestion(channel, user, "Enter message ID:");
      const emoji = await askQuestion(channel, user, "Send the emoji:");
      const mode = Number(await askQuestion(channel, user, "Mode (1-4):"));

      const db = loadDB();

      db.push({
        roleId,
        channelId,
        messageId,
        emoji,
        mode
      });

      saveDB(db);

      const targetChannel = await client.channels.fetch(channelId);
      const targetMessage = await targetChannel.messages.fetch(messageId);

      await targetMessage.react(emoji);

      await interaction.editReply("✅ Reaction role created!");

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Setup failed or timed out.");
    }
  }
});

// ---------------- REACTION ADD ----------------

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  const db = loadDB();

  const config = db.find(c =>
    c.messageId === reaction.message.id &&
    c.emoji === (reaction.emoji.name || reaction.emoji.id)
  );

  if (!config) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.get(config.roleId);

  if (!role) return;

  try {
    if (config.mode === 1 || config.mode === 4) {
      await member.roles.add(role);
      if (config.mode === 1) {
        await user.send(`You received ${role.name}`);
      }
    }

    if (config.mode === 2) {
      await member.roles.add(role);
      await user.send(`Sticky role applied: ${role.name}`);
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
        await user.send(`Double react success: ${role.name}`);
      }

      delete reaction.message._doubleReact[key];
    }

  } catch (err) {
    console.error(err);
  }
});

// ---------------- REACTION REMOVE ----------------

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  const db = loadDB();

  const config = db.find(c =>
    c.messageId === reaction.message.id &&
    c.emoji === (reaction.emoji.name || reaction.emoji.id)
  );

  if (!config) return;
  if (config.mode === 2 || config.mode === 3) return;

  try {
    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.get(config.roleId);

    if (!role) return;

    await member.roles.remove(role);
  } catch (err) {
    console.error(err);
  }
});

// ---------------- READY ----------------

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);