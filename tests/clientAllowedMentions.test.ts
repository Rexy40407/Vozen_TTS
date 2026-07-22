import { GatewayIntentBits } from 'discord.js';
import { describe, it, expect } from 'vitest';
import { createClient } from '../src/bot/client';

describe('createClient security defaults', () => {
  it('disables mentions globally for user-controlled bot output', () => {
    const c = createClient();
    try {
      expect(c.options.allowedMentions).toEqual({ parse: [] });
    } finally {
      void c.destroy();
    }
  });

  it('requests only the gateway intents required by the bot', () => {
    const c = createClient();
    try {
      expect(c.options.intents.has(GatewayIntentBits.Guilds)).toBe(true);
      expect(c.options.intents.has(GatewayIntentBits.GuildVoiceStates)).toBe(true);
      expect(c.options.intents.has(GatewayIntentBits.GuildMessages)).toBe(true);
      expect(c.options.intents.has(GatewayIntentBits.MessageContent)).toBe(true);
      expect(c.options.intents.has(GatewayIntentBits.GuildMembers)).toBe(false);
    } finally {
      void c.destroy();
    }
  });
});
