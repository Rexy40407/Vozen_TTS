import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDiscordCommandContract } from '../src/contracts/discordCommandContract';

describe('Rust migration contracts', () => {
  it('keeps the versioned Rust command fixture identical to the current Discord definitions', () => {
    const fixture = readFileSync(path.resolve('contracts/discord-commands.json'), 'utf8');
    expect(JSON.parse(fixture)).toEqual(JSON.parse(buildDiscordCommandContract()));
  });
});
