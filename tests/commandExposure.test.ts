import { describe, expect, it } from 'vitest';
import { commandDefs, commandExposure } from '../src/commands/definitions';

describe('command exposure policy', () => {
  it('defaults every unreviewed command to guild-only and never User App eligible', () => {
    expect(commandExposure('future-command')).toMatchObject({
      dmSafe: false,
      userAppCandidate: false,
    });
  });

  it('keeps voice, administration and configuration commands out of DMs/User Apps', () => {
    for (const name of [
      'join',
      'leave',
      'tts',
      'Speak',
      'voice',
      'config',
      'setup',
      'transcribe',
      'queue',
      'premium',
    ]) {
      expect(commandExposure(name)).toMatchObject({ dmSafe: false, userAppCandidate: false });
    }
  });

  it('exposes only reviewed private tools to User Install contexts', () => {
    for (const name of ['tts-file', 'translate', 'Translate', 'Transcribe voice message']) {
      expect(commandExposure(name)).toMatchObject({ dmSafe: true, userAppCandidate: true });
      const definition = commandDefs.find((entry) => entry.name === name);
      expect(definition?.integration_types).toEqual([0, 1]);
      expect(definition?.contexts).toEqual([0, 1, 2]);
    }
  });

  it('has exactly the reviewed DM-safe command set and restricts all other registered commands', () => {
    const dmSafe = commandDefs
      .filter((def) => commandExposure(def.name).dmSafe)
      .map((def) => def.name);
    expect(dmSafe).toEqual([
      'invite',
      'vote',
      'help',
      'tts-file',
      'translate',
      'uptime',
      'bot-stats',
      'Translate',
      'Transcribe voice message',
      'redeem',
    ]);
    for (const def of commandDefs) {
      if (!commandExposure(def.name).dmSafe) {
        expect((def as { contexts?: number[] }).contexts).toEqual([0]);
        expect(def.integration_types).toEqual([0]);
      }
    }
  });
});
