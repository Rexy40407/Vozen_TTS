import { describe, expect, it } from 'vitest';
import {
  CAST_LANGUAGE_CHOICES,
  CAST_THEMES,
  assignCast,
  buildCastSpeech,
  chunkCastSpeech,
  castThemeByKey,
} from '../src/content/cast';
import { commandDefs } from '../src/commands/definitions';
import { handleInteraction } from '../src/commands/index';
import { initDb } from '../src/store/db';
import { resolveCastVoice } from '../src/commands/handlers/cast';

describe('cast content', () => {
  it('contains the Pokémon selector plus safe non-franchise themes', () => {
    expect(castThemeByKey('pokemon')).toBeDefined();
    expect(castThemeByKey('anime')).toBeDefined();
    expect(CAST_THEMES.map((theme) => theme.key)).toEqual(
      expect.arrayContaining(['pokemon', 'anime', 'animals', 'food']),
    );
    for (const theme of CAST_THEMES) expect(theme.entries.length).toBeGreaterThanOrEqual(25);
  });

  it('defaults the language selector to English', () => {
    expect(CAST_LANGUAGE_CHOICES[0]).toEqual({ name: 'English', value: 'en' });
    expect(CAST_LANGUAGE_CHOICES.length).toBe(19);
    expect(new Set(CAST_LANGUAGE_CHOICES.map((choice) => choice.value)).size).toBe(19);
  });

  it('assigns one unique entry to every human participant, excluding bots', () => {
    const result = assignCast(
      [
        { id: 'u1', displayName: 'Micon', bot: false },
        { id: 'bot', displayName: 'Helper', bot: true },
        { id: 'u2', displayName: 'Rafa', bot: false },
      ],
      'pokemon',
      () => 0,
    );

    expect(result.map((row) => row.userId)).toEqual(['u1', 'u2']);
    expect(new Set(result.map((row) => row.entry.id)).size).toBe(2);
  });

  it('uses the injected random source and never mutates the participant list', () => {
    const members = [
      { id: 'u2', displayName: 'Rafa', bot: false },
      { id: 'u1', displayName: 'Micon', bot: false },
    ];
    const snapshot = members.map((member) => ({ ...member }));
    const result = assignCast(members, 'animals', () => 0.999);

    expect(members).toEqual(snapshot);
    expect(result.map((row) => row.displayName)).toEqual(['Micon', 'Rafa']);
    expect(result[0].entry.id).not.toBe(result[1].entry.id);
  });

  it('builds localized speech and uses English when no language is provided', () => {
    const assignments = [
      { userId: 'u1', displayName: 'Diogo', entry: { id: 'pikachu', label: 'Pikachu' } },
      { userId: 'u2', displayName: 'Rafa', entry: { id: 'squirtle', label: 'Squirtle' } },
    ];

    expect(buildCastSpeech(assignments)).toBe('Diogo is Pikachu and Rafa is Squirtle.');
    expect(buildCastSpeech(assignments, 'pt')).toBe('Diogo é Pikachu e Rafa é Squirtle.');
  });

  it('chunks long speech without splitting a participant assignment', () => {
    const assignments = Array.from({ length: 10 }, (_, index) => ({
      userId: `u${index}`,
      displayName: `Participant ${index}`,
      entry: { id: `entry-${index}`, label: `A very long original creature ${index}` },
    }));
    const speech = buildCastSpeech(assignments);
    const chunks = chunkCastSpeech(speech, 100);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(chunks.join(' ')).toContain('Participant 9 is A very long original creature 9.');
  });
});

describe('/cast voice resolution', () => {
  it('uses the invoker’s compatible chosen Piper voice and speed', () => {
    expect(
      resolveCastVoice(
        'en',
        'piper',
        ['en_US-amy-medium', 'en_GB-alan-medium'],
        { model: 'en_GB-alan-medium', speed: 0.8, engine: 'piper' },
        'en_US-amy-medium',
        1,
      ),
    ).toEqual({ model: 'en_GB-alan-medium', speed: 0.8 });
  });

  it('does not make Piper pronounce a language with a synthetic or foreign fallback voice', () => {
    expect(
      resolveCastVoice(
        'pt',
        'piper',
        ['en_US-amy-medium', 'pt_PT-google-medium'],
        null,
        'en_US-amy-medium',
        1,
      ),
    ).toBeNull();
  });
});

describe('/cast registration', () => {
  it('is registered as a top-level command with no required options', () => {
    const cast = commandDefs.find((command) => command.name === 'cast');
    expect(cast).toBeDefined();
    expect(cast?.options ?? []).toEqual([]);
  });
});

describe('/cast handler', () => {
  it('requires Vozen to already be in the invoker voice channel', async () => {
    const db = initDb(':memory:');
    const reply = async (payload: unknown) => {
      replies.push(JSON.stringify(payload));
    };
    const replies: string[] = [];
    const interaction = {
      commandName: 'cast',
      guildId: 'g-cast',
      locale: 'en-US',
      user: { id: 'u1' },
      reply,
      replies,
      isRepliable: () => true,
      guild: { members: { cache: new Map() } },
      member: { voice: { channelId: 'voice-1' } },
      channel: null,
    };
    const deps = {
      client: { user: { id: 'bot-1' } },
      db,
      players: new Map(),
      limiters: new Map(),
      config: { defaultSpeed: 1, defaultVoice: 'en_US-amy-medium' },
      availableModels: ['en_US-amy-medium'],
    } as any;

    await handleInteraction(interaction as any, deps);

    expect(replies.join(' ')).toMatch(/join/i);
    db.close();
  });

  it('reveals a public cast after the author selects a theme and confirms', async () => {
    const db = initDb(':memory:');
    const publicReplies: string[] = [];
    const edits: string[] = [];
    const sayRequests: Array<{ text: string; engine?: string }> = [];
    const say = async (request: { text: string; engine?: string }) => {
      sayRequests.push(request);
      spoken.push(request.text);
      return true;
    };
    const spoken: string[] = [];
    const voiceMembers = new Map([
      ['u1', { id: 'u1', displayName: '🔥Diogo🔥', user: { bot: false } }],
      ['u2', { id: 'u2', displayName: 'Rafa', user: { bot: false } }],
      ['bot-1', { id: 'bot-1', displayName: 'Vozen', user: { bot: true } }],
    ]);
    const componentEvents = [
      {
        customId: 'cast:theme:cast-1',
        values: ['pokemon'],
        isButton: () => false,
        isStringSelectMenu: () => true,
        deferUpdate: async () => {},
      },
      {
        customId: 'cast:language:cast-1',
        values: ['en'],
        isButton: () => false,
        isStringSelectMenu: () => true,
        deferUpdate: async () => {},
      },
      {
        customId: 'cast:engine:cast-1',
        values: ['piper'],
        isButton: () => false,
        isStringSelectMenu: () => true,
        deferUpdate: async () => {},
      },
      {
        customId: 'cast:reveal:cast-1',
        isButton: () => true,
        isStringSelectMenu: () => false,
        deferUpdate: async () => {},
      },
    ];
    const interaction = {
      id: 'cast-1',
      commandName: 'cast',
      guildId: 'g-cast',
      locale: 'en-US',
      user: { id: 'u1' },
      member: { voice: { channelId: 'voice-1' } },
      guild: {
        members: {
          cache: new Map([
            [
              'u1',
              {
                id: 'u1',
                displayName: '🔥Diogo🔥',
                user: { bot: false },
                voice: { channelId: 'voice-1' },
                roles: { cache: new Map() },
              },
            ],
            [
              'u2',
              {
                id: 'u2',
                displayName: 'Rafa',
                user: { bot: false },
                voice: { channelId: 'voice-1' },
              },
            ],
            [
              'bot-1',
              {
                id: 'bot-1',
                displayName: 'Vozen',
                user: { bot: true },
                voice: { channelId: 'voice-1' },
              },
            ],
          ]),
          me: { voice: { channelId: 'voice-1' } },
        },
        channels: { cache: new Map([['voice-1', { id: 'voice-1', members: voiceMembers }]]) },
      },
      channel: {
        awaitMessageComponent: async () => componentEvents.shift(),
      },
      reply: async () => {},
      editReply: async (payload: unknown) => edits.push(JSON.stringify(payload)),
      followUp: async (payload: unknown) => publicReplies.push(JSON.stringify(payload)),
      isRepliable: () => true,
    };
    const deps = {
      client: { user: { id: 'bot-1' } },
      db,
      players: new Map([['g-cast', { say }]]),
      limiters: new Map(),
      config: { defaultSpeed: 1, defaultVoice: 'en_US-amy-medium' },
      availableModels: ['en_US-amy-medium'],
    } as any;

    await handleInteraction(interaction as any, deps);

    expect(publicReplies.join(' ')).toMatch(/Pikachu|Charmander|Squirtle|is/i);
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken.join(' ')).toMatch(/is/i);
    expect(spoken.join(' ')).toContain('Diogo');
    expect(spoken.join(' ')).not.toContain('🔥');
    expect(sayRequests[0]?.engine).toBe('piper');
    expect(edits.length).toBeGreaterThan(0);
    // The panel is edited after each selection. The selected theme must stay
    // selected in the rebuilt menu instead of falling back to its placeholder.
    expect(edits.join(' ')).toMatch(/"value":"pokemon"[^}]*"default":true/);
    expect(edits.join(' ')).toMatch(/"custom_id":"cast:engine:cast-1"/);
    expect(edits.join(' ')).toContain('"label":"Google"');
    expect(edits.join(' ')).toContain('"label":"Kokoro"');
    expect(edits.join(' ')).toMatch(/"value":"piper"[^}]*"default":true/);
    db.close();
  });
});
