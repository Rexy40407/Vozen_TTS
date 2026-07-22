import { commandDefs, ownerCommandDefs } from '../commands/definitions';

export const DISCORD_COMMAND_CONTRACT_VERSION = 1;
export const DISCORD_COMMAND_CONTRACT_SOURCE = 'src/commands/definitions.ts';

/**
 * Language-neutral command catalog consumed by the Rust rewrite. Keep this deliberately
 * mechanical: Discord's command JSON remains the source of truth until Rust owns registration.
 */
export function buildDiscordCommandContract(): string {
  return `${JSON.stringify(
    {
      schema_version: DISCORD_COMMAND_CONTRACT_VERSION,
      generated_from: DISCORD_COMMAND_CONTRACT_SOURCE,
      public_commands: commandDefs,
      owner_commands: ownerCommandDefs,
    },
    null,
    2,
  )}\n`;
}
