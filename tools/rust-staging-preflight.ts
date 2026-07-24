import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DEFAULT_TIMEOUT_MS = 5_000;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

const commandContract = JSON.parse(
  readFileSync(resolve(process.cwd(), 'contracts/discord-commands.json'), 'utf8'),
) as {
  public_commands?: Array<{ name?: unknown }>;
  owner_commands?: Array<{ name?: unknown }>;
};

export interface RustStagingPreflightEnv {
  DISCORD_TOKEN?: string;
  CLIENT_ID?: string;
  RUST_COMMANDS_GUILD_ID?: string;
  OWNER_GUILD_ID?: string;
}

export interface RustStagingPreflightOptions {
  env: RustStagingPreflightEnv;
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

export interface RustStagingPreflightReport {
  ok: true;
  botUserMatchesApplication: boolean;
  guildReachable: boolean;
  guildCommandCount: number;
  expectedGuildCommandCount: number;
  ownerGuildCommandCount: number | null;
  globalCommandCount: number;
}

export type RustStagingPreflightFailureCode =
  | 'invalid_config'
  | 'discord_request_failed'
  | 'invalid_response'
  | 'application_mismatch'
  | 'guild_command_mismatch';

export class RustStagingPreflightError extends Error {
  constructor(
    readonly code: RustStagingPreflightFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'RustStagingPreflightError';
  }
}

function validSnowflake(value: string | undefined): value is string {
  return value !== undefined && SNOWFLAKE_PATTERN.test(value.trim());
}

function requiredEnv(env: RustStagingPreflightEnv, key: keyof RustStagingPreflightEnv): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new RustStagingPreflightError('invalid_config', `${key} is required`);
  }
  return value;
}

function requiredSnowflake(
  env: RustStagingPreflightEnv,
  key: 'CLIENT_ID' | 'RUST_COMMANDS_GUILD_ID',
): string {
  const value = requiredEnv(env, key);
  if (!validSnowflake(value)) {
    throw new RustStagingPreflightError('invalid_config', `${key} must be a Discord snowflake`);
  }
  return value;
}

function jsonRecord(value: unknown, endpoint: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RustStagingPreflightError(
      'invalid_response',
      `Discord returned an invalid ${endpoint} response`,
    );
  }
  return value as JsonRecord;
}

function responseArray(value: unknown, endpoint: string): JsonRecord[] {
  if (!Array.isArray(value) || value.some((item) => item === null || typeof item !== 'object')) {
    throw new RustStagingPreflightError(
      'invalid_response',
      `Discord returned an invalid ${endpoint} response`,
    );
  }
  return value as JsonRecord[];
}

async function getJson(
  fetchImpl: FetchLike,
  url: string,
  token: string,
  endpoint: string,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bot ${token}`,
      },
      signal: controller.signal,
    });
  } catch {
    throw new RustStagingPreflightError(
      'discord_request_failed',
      `Discord ${endpoint} request failed`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new RustStagingPreflightError(
      'discord_request_failed',
      `Discord ${endpoint} request returned HTTP ${response.status}`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new RustStagingPreflightError(
      'invalid_response',
      `Discord returned invalid JSON for ${endpoint}`,
    );
  }
}

function commandNames(commands: JsonRecord[], endpoint: string): string[] {
  return commands.map((command) => {
    if (typeof command.name !== 'string' || command.name.length === 0) {
      throw new RustStagingPreflightError(
        'invalid_response',
        `Discord returned an invalid command in ${endpoint}`,
      );
    }
    return command.name;
  });
}

function compareCommandNames(actual: string[], expected: string[]): boolean {
  const sort = (names: string[]) => [...names].sort();
  return JSON.stringify(sort(actual)) === JSON.stringify(sort(expected));
}

/**
 * Projects an API command onto the fields present in the generated contract. Discord adds
 * volatile identifiers and response metadata (id, version, application_id, guild_id, ...), so
 * those are deliberately ignored; every stable field that Rust would register is compared,
 * including nested options and choices.
 */
function projectContractShape(actual: unknown, expected: unknown): unknown {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return { __missing: true };
    return expected.map((item, index) => projectContractShape(actual[index], item));
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      return { __missing: true };
    }
    const actualRecord = actual as JsonRecord;
    return Object.fromEntries(
      Object.entries(expected as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [
          key,
          Object.prototype.hasOwnProperty.call(actualRecord, key)
            ? projectContractShape(actualRecord[key], value)
            : discordDefaultOmission(key, value)
              ? discordDefaultValue(key, value)
              : { __missing: true },
        ]),
    );
  }
  return actual;
}

/**
 * Discord does not echo every command payload field for guild commands. In particular,
 * empty option arrays, `required: false`, and installation-context fields may be omitted
 * from the GET response even though they were accepted by the PUT request. Treat only these
 * documented defaults as equivalent; all non-default drift remains a preflight failure.
 */
function discordDefaultOmission(key: string, expected: unknown): boolean {
  return (
    (key === 'options' && Array.isArray(expected) && expected.length === 0) ||
    (key === 'required' && expected === false) ||
    ((key === 'contexts' || key === 'integration_types') && Array.isArray(expected))
  );
}

function discordDefaultValue(key: string, expected: unknown): unknown {
  if (key === 'options') return [];
  if (key === 'required') return false;
  return expected;
}

function compareCommandContracts(actual: JsonRecord[], expected: JsonRecord[]): boolean {
  const sortByName = (commands: JsonRecord[]) =>
    [...commands].sort((left, right) => String(left.name).localeCompare(String(right.name)));
  const sortedActual = sortByName(actual);
  const sortedExpected = sortByName(expected);
  if (sortedActual.length !== sortedExpected.length) return false;
  return sortedExpected.every((contractCommand, index) => {
    const liveCommand = sortedActual[index];
    return (
      liveCommand.name === contractCommand.name &&
      JSON.stringify(projectContractShape(liveCommand, contractCommand)) ===
        JSON.stringify(projectContractShape(contractCommand, contractCommand))
    );
  });
}

export async function runRustStagingPreflight(
  options: RustStagingPreflightOptions,
): Promise<RustStagingPreflightReport> {
  const token = requiredEnv(options.env, 'DISCORD_TOKEN');
  const clientId = requiredSnowflake(options.env, 'CLIENT_ID');
  const guildId = requiredSnowflake(options.env, 'RUST_COMMANDS_GUILD_ID');
  const ownerGuildId = options.env.OWNER_GUILD_ID?.trim();
  if (ownerGuildId !== undefined && ownerGuildId !== '' && !validSnowflake(ownerGuildId)) {
    throw new RustStagingPreflightError(
      'invalid_config',
      'OWNER_GUILD_ID must be a Discord snowflake',
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = (options.apiBaseUrl ?? DISCORD_API_BASE).replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const botUser = jsonRecord(
    await getJson(fetchImpl, `${apiBase}/users/@me`, token, 'bot identity', timeoutMs),
    'bot identity',
  );
  if (botUser.id !== clientId) {
    throw new RustStagingPreflightError(
      'application_mismatch',
      'Discord bot identity does not match CLIENT_ID',
    );
  }

  const guild = jsonRecord(
    await getJson(fetchImpl, `${apiBase}/guilds/${guildId}`, token, 'staging guild', timeoutMs),
    'staging guild',
  );
  if (guild.id !== guildId) {
    throw new RustStagingPreflightError(
      'invalid_response',
      'Discord returned a different staging guild',
    );
  }

  const guildCommands = responseArray(
    await getJson(
      fetchImpl,
      `${apiBase}/applications/${clientId}/guilds/${guildId}/commands`,
      token,
      'staging commands',
      timeoutMs,
    ),
    'staging commands',
  );
  const expectedCommands = [...(commandContract.public_commands ?? [])];
  if (ownerGuildId === guildId) {
    expectedCommands.push(...(commandContract.owner_commands ?? []));
  }
  const expectedNames = expectedCommands.flatMap((command) =>
    typeof command.name === 'string' ? [command.name] : [],
  );
  const actualNames = commandNames(guildCommands, 'staging commands');
  if (
    !compareCommandNames(actualNames, expectedNames) ||
    !compareCommandContracts(guildCommands, expectedCommands as JsonRecord[])
  ) {
    throw new RustStagingPreflightError(
      'guild_command_mismatch',
      `Staging command set differs from the Rust contract (got ${actualNames.length}, expected ${expectedNames.length})`,
    );
  }

  let ownerGuildCommandCount: number | null = null;
  if (ownerGuildId && ownerGuildId !== guildId) {
    const ownerGuild = jsonRecord(
      await getJson(
        fetchImpl,
        `${apiBase}/guilds/${ownerGuildId}`,
        token,
        'owner guild',
        timeoutMs,
      ),
      'owner guild',
    );
    if (ownerGuild.id !== ownerGuildId) {
      throw new RustStagingPreflightError(
        'invalid_response',
        'Discord returned a different owner guild',
      );
    }
    const ownerCommands = responseArray(
      await getJson(
        fetchImpl,
        `${apiBase}/applications/${clientId}/guilds/${ownerGuildId}/commands`,
        token,
        'owner commands',
        timeoutMs,
      ),
      'owner commands',
    );
    const ownerNames = commandNames(ownerCommands, 'owner commands');
    const expectedOwnerCommands = [...(commandContract.owner_commands ?? [])];
    const expectedOwnerNames = expectedOwnerCommands.flatMap((command) =>
      typeof command.name === 'string' ? [command.name] : [],
    );
    if (
      !compareCommandNames(ownerNames, expectedOwnerNames) ||
      !compareCommandContracts(ownerCommands, expectedOwnerCommands as JsonRecord[])
    ) {
      throw new RustStagingPreflightError(
        'guild_command_mismatch',
        `Owner command set differs from the Rust contract (got ${ownerNames.length}, expected ${expectedOwnerNames.length})`,
      );
    }
    ownerGuildCommandCount = ownerNames.length;
  }

  const globalCommands = responseArray(
    await getJson(
      fetchImpl,
      `${apiBase}/applications/${clientId}/commands`,
      token,
      'global commands',
      timeoutMs,
    ),
    'global commands',
  );

  return {
    ok: true,
    botUserMatchesApplication: true,
    guildReachable: true,
    guildCommandCount: actualNames.length,
    expectedGuildCommandCount: expectedNames.length,
    ownerGuildCommandCount,
    globalCommandCount: globalCommands.length,
  };
}

async function main(): Promise<void> {
  try {
    const envFile = process.env.RUST_ENV_FILE?.trim();
    if (envFile) {
      const loaded = loadDotenv({ path: resolve(process.cwd(), envFile), override: false });
      if (loaded.error) {
        throw new RustStagingPreflightError('invalid_config', 'RUST_ENV_FILE could not be loaded');
      }
    }
    const report = await runRustStagingPreflight({ env: process.env });
    console.log(JSON.stringify(report));
  } catch (error: unknown) {
    if (error instanceof RustStagingPreflightError) {
      console.error(`[rust-staging-preflight] ${error.code}: ${error.message}`);
    } else {
      console.error('[rust-staging-preflight] unexpected failure');
    }
    process.exitCode = 1;
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/tools/rust-staging-preflight.ts')) {
  void main();
}
