import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DISCORD_API = "https://discord.com/api/v10";
const REQUIRED = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "RUST_COMMANDS_GUILD_ID",
  "OWNER_GUILD_ID",
];

function fail(message) {
  console.error(`Staging preflight failed: ${message}`);
  process.exitCode = 1;
}

function parseDotenv(source) {
  const values = new Map();
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) continue;
    let [, key, value] = match;
    value = value.trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

async function loadStagingEnv() {
  const envFile = process.env.RUST_ENV_FILE;
  if (!envFile) return;
  const parsed = parseDotenv(await readFile(resolve(envFile), "utf8"));
  for (const [key, value] of parsed) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function snowflake(name) {
  const value = process.env[name]?.trim();
  if (!value || !/^\d{17,20}$/u.test(value)) {
    fail(`${name} must be a Discord ID.`);
    return undefined;
  }
  return value;
}

async function discordGet(path, token) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${token}`, "User-Agent": "Vozen-Staging-Preflight/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Discord returned HTTP ${response.status} for ${path}.`);
  }
  return response.json();
}

function commandKey(command) {
  return `${command.type ?? 1}:${command.name}`;
}

function expectedCommandKeys(contract, includeOwner) {
  const commands = includeOwner
    ? [...contract.public_commands, ...contract.owner_commands]
    : contract.public_commands;
  return new Set(commands.map(commandKey));
}

async function verifyGuild(guildId, clientId, token, expected, label) {
  await discordGet(`/guilds/${guildId}`, token);
  const commands = await discordGet(`/applications/${clientId}/guilds/${guildId}/commands`, token);
  const present = new Set(commands.map(commandKey));
  const missing = [...expected].filter((key) => !present.has(key));
  console.log(`${label}: bot is present; ${commands.length} guild commands currently registered.`);
  if (missing.length) {
    console.log(`${label}: ${missing.length} expected command(s) are not registered yet (expected before first staging start).`);
  } else {
    console.log(`${label}: registered command set matches the Rust contract.`);
  }
}

try {
  await loadStagingEnv();
  for (const key of REQUIRED) {
    if (!process.env[key]?.trim()) fail(`${key} is required.`);
  }
  if (process.exitCode) process.exit();

  const clientId = snowflake("CLIENT_ID");
  const stagingGuildId = snowflake("RUST_COMMANDS_GUILD_ID");
  const ownerGuildId = snowflake("OWNER_GUILD_ID");
  const token = process.env.DISCORD_TOKEN.trim();
  if (process.exitCode || !clientId || !stagingGuildId || !ownerGuildId) process.exit();

  const contract = JSON.parse(await readFile(resolve("contracts/discord-commands.json"), "utf8"));
  const bot = await discordGet("/users/@me", token);
  if (bot.id !== clientId) {
    fail("CLIENT_ID does not match the staging bot token. Check that both belong to Vozen Staging.");
    process.exit();
  }
  console.log("Bot token and staging application identity verified.");

  const globalCommands = await discordGet(`/applications/${clientId}/commands`, token);
  console.log(`Global commands currently registered: ${globalCommands.length}.`);
  await verifyGuild(
    stagingGuildId,
    clientId,
    token,
    expectedCommandKeys(contract, ownerGuildId === stagingGuildId),
    "Staging guild",
  );
  if (ownerGuildId !== stagingGuildId) {
    await verifyGuild(ownerGuildId, clientId, token, expectedCommandKeys(contract, true), "Owner guild");
  }
  console.log("Staging preflight passed. No Discord commands were changed.");
} catch (error) {
  fail(error instanceof Error ? error.message : "Unexpected preflight error.");
}
