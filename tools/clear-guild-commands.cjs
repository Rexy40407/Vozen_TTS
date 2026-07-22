// tools/clear-guild-commands.cjs — DELETES all GUILD-SCOPED slash commands in the
// bot's servers (or in a guild id passed via argv). Does the inverse of
// register-guild.cjs: reverts to "pure global".
//
// WHY: a guild command with the same name as a global one appears TWICE in the
// Discord picker (guild + global both show up). register-guild.cjs only serves
// to see a new option INSTANTLY, without waiting for the global propagation (~1h).
// After the global propagates, the guild ones must be cleared or it stays duplicated.
//
// The token comes from loadConfig() (require('dotenv/config')) — it is NEVER printed.
// Usage: node tools/clear-guild-commands.cjs [guildId]   (no arg = all of the bot's guilds)

const { REST, Routes } = require('discord.js');
const { loadConfig } = require('../dist/config/index.js');

async function main() {
  const cfg = loadConfig();
  const rest = new REST({ version: '10' }).setToken(cfg.token);

  let guildIds = process.argv.slice(2).filter(Boolean);
  if (guildIds.length === 0) {
    const guilds = await rest.get(Routes.userGuilds());
    guildIds = guilds.map((g) => g.id);
    console.log(
      `[clear-guild] bot está em ${guilds.length} servidor(es): ${guilds.map((g) => g.name).join(', ')}`,
    );
  }

  for (const gid of guildIds) {
    // PUT with an empty body removes ALL guild commands in that server.
    await rest.put(Routes.applicationGuildCommands(cfg.clientId, gid), { body: [] });
    console.log(`[clear-guild] guild commands deleted in guild ${gid}; global commands remain.`);
  }
  console.log(
    '[clear-guild] done. Duplicates are gone; press Ctrl+R in Discord. Global commands remain.',
  );
}

main().catch((err) => {
  console.error('[clear-guild] failed:', err?.message || err);
  process.exit(1);
});
