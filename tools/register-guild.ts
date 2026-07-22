/**
 * tools/register-guild.ts — registers the commands per-SERVER (instant), instead of
 * globally (which takes up to ~1h to propagate). Useful for TESTING new commands now.
 *
 * WARNING: server commands do NOT replace the global ones — Discord shows BOTH
 * sets in the picker (DUPLICATED commands). So this is a temporary testing tool:
 * as soon as the global ones propagate, run `--clear` to remove the per-server
 * ones and get each command ONCE again.
 *
 *   npx tsx tools/register-guild.ts           # registers per-server (appears now, DUPLICATES)
 *   npx tsx tools/register-guild.ts --clear   # clears the per-server ones (only global remains)
 */
import { REST, Routes } from 'discord.js';
import { commandDefs } from '../src/commands/index';
import { loadConfig } from '../src/config/index';

async function main(): Promise<void> {
  const clear = process.argv.includes('--clear');
  const cfg = loadConfig();
  const rest = new REST({ version: '10' }).setToken(cfg.token);
  const guilds = (await rest.get(Routes.userGuilds())) as { id: string; name: string }[];
  if (!guilds.length) {
    console.error('The bot is not in any server. Invite it first.');
    process.exit(1);
  }
  for (const g of guilds) {
    const body = clear ? [] : commandDefs;
    await rest.put(Routes.applicationGuildCommands(cfg.clientId, g.id), { body });
    console.log(
      clear
        ? `🧹 comandos por-servidor LIMPOS em "${g.name}" (${g.id}) — fica só o conjunto global.`
        : `✅ ${commandDefs.length} comandos registados em "${g.name}" (${g.id}) — já aparecem (DUPLICADOS com os globais até correres --clear).`,
    );
  }
  console.log('\nReload Discord (Ctrl+R) if the change is not immediately visible.');
}

main().catch((err) => {
  console.error('Failed to register guild commands:', err);
  process.exit(1);
});
