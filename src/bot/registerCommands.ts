import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REST, Routes } from 'discord.js';
import { commandDefs, ownerCommandDefs } from '../commands/index';
import { loadConfig } from '../config/index';
import { log } from '../logging/logger';

/** Stable fingerprint of the command set (to detect changes between boots). */
export function commandsFingerprint(defs: unknown): string {
  return createHash('sha1').update(JSON.stringify(defs)).digest('hex');
}

interface RegisterState {
  clientId: string;
  fingerprint: string;
  at: string;
}

/**
 * true if registration can be SKIPPED: the saved state matches the current
 * fingerprint (same app, same commands). Any read error => false (register).
 */
export function shouldSkipRegister(
  stateFile: string,
  clientId: string,
  fingerprint: string,
): boolean {
  try {
    const prev = JSON.parse(readFileSync(stateFile, 'utf8')) as RegisterState;
    return prev.clientId === clientId && prev.fingerprint === fingerprint;
  } catch {
    return false;
  }
}

/** Saves the registration state (best-effort: failing here only costs a re-PUT on the next boot). */
export function saveRegisterState(stateFile: string, clientId: string, fingerprint: string): void {
  try {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(
      stateFile,
      JSON.stringify({
        clientId,
        fingerprint,
        at: new Date().toISOString(),
      } satisfies RegisterState),
    );
  } catch (err) {
    log.warn(
      '[register] failed to persist registration state; commands will register again on next startup',
      err,
    );
  }
}

/**
 * Syncs the global slash commands. With `stateFile`, the global PUT only happens
 * when the command set has CHANGED since the last registration (fingerprint):
 *  - the global PUT is heavily rate-limited and has a daily quota — frequent
 *    restarts (dev) burned through it needlessly;
 *  - re-registering bumps the command version and invalidates the Discord
 *    client cache, which coincides with transient autocomplete failures
 *    ("Failed to load options") right after a restart.
 * FORCE_REGISTER=1 ignores the state and always registers. Returns true if it registered.
 */
export async function registerCommands(
  token: string,
  clientId: string,
  opts: { stateFile?: string } = {},
): Promise<boolean> {
  const fingerprint = commandsFingerprint(commandDefs);
  if (
    opts.stateFile &&
    process.env.FORCE_REGISTER !== '1' &&
    shouldSkipRegister(opts.stateFile, clientId, fingerprint)
  ) {
    log.info(`[register] commands unchanged (${fingerprint.slice(0, 8)}); global PUT skipped.`);
    return false;
  }
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commandDefs });
  log.info(`[register] ${commandDefs.length} commands registered globally.`);
  if (opts.stateFile) saveRegisterState(opts.stateFile, clientId, fingerprint);
  return true;
}

/**
 * Registers the OWNER-ONLY commands as GUILD commands in the control `guildId` — NOT
 * global. This way the public doesn't even see them in the picker (1st layer of defense;
 * the 2nd is the owner gate in the handler). A guild PUT isn't subject to the global
 * rate-limit and propagates instantly.
 */
export async function registerOwnerCommands(
  token: string,
  clientId: string,
  guildId: string,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: ownerCommandDefs });
  log.info(
    `[register] ${ownerCommandDefs.length} owner command(s) registered in guild ${guildId}.`,
  );
}

// startup when run via `npm run register`
if (process.argv[1] && process.argv[1].endsWith('registerCommands.ts')) {
  const cfg = loadConfig();
  const stateFile = join(dirname(cfg.dbPath), 'commands-state.json');
  registerCommands(cfg.token, cfg.clientId, { stateFile }).catch((err) => {
    log.error('[register] failed', err);
    process.exit(1);
  });
}
