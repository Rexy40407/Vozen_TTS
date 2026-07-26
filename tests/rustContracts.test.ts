import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDiscordCommandContract } from '../src/contracts/discordCommandContract';

describe('Rust migration contracts', () => {
  it('keeps the versioned Rust command fixture identical to the current Discord definitions', () => {
    const fixture = readFileSync(path.resolve('contracts/discord-commands.json'), 'utf8');
    expect(JSON.parse(fixture)).toEqual(JSON.parse(buildDiscordCommandContract()));
  });

  it('keeps Portuguese private-file responses UTF-8 encoded', () => {
    const contract = JSON.parse(
      readFileSync(path.resolve('contracts/voice-response-i18n.json'), 'utf8'),
    ) as { messages: Record<string, Record<string, string>> };
    const portuguese = contract.messages.pt;

    expect(portuguese['ttsFile.ready']).toBe(
      'O teu ficheiro de áudio privado está pronto. O Vozen não o guarda depois da entrega.',
    );
    expect(portuguese['ttsFile.tooLong']).toContain('exportação de áudio');
    expect(portuguese['ttsFile.unavailable']).toContain('não está disponível');
    expect(portuguese['ttsFile.failed']).toContain('Não consegui');
    expect(Object.values(portuguese)).not.toContain(expect.stringContaining('Ã'));
  });

  it('includes every /stats renderer key in the Rust i18n contract', () => {
    const contract = JSON.parse(
      readFileSync(path.resolve('contracts/voice-response-i18n.json'), 'utf8'),
    ) as { keys: string[]; messages: Record<string, Record<string, string>> };
    const statsKeys = [
      'stats.title',
      'stats.messagesSpoken',
      'stats.cacheHits',
      'stats.cacheMisses',
      'stats.synthErrors',
      'stats.synthLatency',
      'stats.voiceDrops',
      'stats.voiceReconnects',
      'stats.votes',
      'stats.activePlayers',
      'stats.servers',
      'stats.uptime',
    ];

    expect(contract.keys).toEqual(expect.arrayContaining(statsKeys));
    for (const locale of Object.keys(contract.messages)) {
      for (const key of statsKeys)
        expect(contract.messages[locale][key]).toEqual(expect.any(String));
    }
  });
});
