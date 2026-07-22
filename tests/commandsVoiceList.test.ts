import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Minimal mock of @discordjs/voice — not used in /voice list, but the import in
// index.ts resolves it (same pattern as commandsPreview.test.ts).
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction } from '../src/commands/index';
import { formatVoiceList, voiceDisplayName } from '../src/language/voiceMap';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import type Database from 'better-sqlite3';

const GUILD = 'g-list';
const USER = 'u-list';

function makeDeps(db: Database.Database, availableModels: string[]): BotDeps {
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map<string, unknown>(),
    db,
    config: { defaultSpeed: 1.0, defaultVoice: '' },
    availableModels,
    limiters: new Map(),
  } as unknown as BotDeps;
}

function makeListInteraction() {
  const replies: string[] = [];
  return {
    commandName: 'voice',
    guildId: GUILD,
    user: { id: USER },
    replies,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: { content?: string; embeds?: { data?: { description?: string } }[] }) => {
      // /voice list now uses an embed — record text OR the embed description.
      const fromEmbeds = (o.embeds ?? []).map((e) => e?.data?.description ?? '').join('\n');
      replies.push(o.content ?? fromEmbeds);
    },
    options: {
      getSubcommandGroup: (_required = false) => null,
      getSubcommand: () => 'list',
      getString: () => null,
      getNumber: () => null,
    },
  };
}

describe('formatVoiceList (grouping by language)', () => {
  it('groups by language, with a friendly header and the id in parentheses', () => {
    const out = formatVoiceList(['en_US-ryan-medium', 'en_US-amy-medium', 'pt_PT-tugao-medium']);
    // One header per language (autonym), voices sorted by name, copy-pasteable id.
    expect(out).toBe(
      [
        'English (US)',
        '• Amy (en_US-amy-medium)',
        '• Ryan (en_US-ryan-medium)',
        'Português (Portugal)',
        '• Tugao (pt_PT-tugao-medium)',
      ].join('\n'),
    );
  });

  it('unmapped locale -> header falls back to the locale itself (never hides the voice)', () => {
    const out = formatVoiceList(['xx_YY-foo-medium']);
    expect(out).toContain('xx_YY');
    expect(out).toContain('(xx_YY-foo-medium)');
  });

  it('model with no 2nd segment -> uses the raw id as the voice name (guard)', () => {
    const out = formatVoiceList(['en_US']);
    expect(out).toContain('English (US)');
    expect(out).toContain('en_US');
  });
});

describe('voiceDisplayName (friendly language + voice name)', () => {
  it('combines the language autonym with the human voice name', () => {
    expect(voiceDisplayName('en_US-amy-medium')).toBe('English (US) — Amy');
    expect(voiceDisplayName('pt_PT-tugao-medium')).toBe('Português (Portugal) — Tugao');
  });

  it('distinguishes two voices of the SAME language (does not collapse to the autonym)', () => {
    expect(voiceDisplayName('en_US-amy-medium')).not.toBe(voiceDisplayName('en_US-ryan-medium'));
  });

  it('unmapped locale -> falls back to the raw id as language (never hides the voice)', () => {
    const out = voiceDisplayName('xx_YY-foo-medium');
    expect(out).toContain('xx_YY');
    expect(out).toContain('Foo');
  });

  it('model with no voice (no "-") -> falls back to just the language name (guard, no empty suffix)', () => {
    // With no 2nd segment there is no voice name to append: returns only the language
    // autonym (never "English (US) — " with an empty suffix).
    expect(voiceDisplayName('en_US')).toBe('English (US)');
  });
});

describe('/voice list (grouped handler)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('replies with the voices GROUPED by language and friendly names', async () => {
    const deps = makeDeps(db, ['en_US-amy-medium', 'en_US-ryan-medium', 'pt_PT-tugao-medium']);
    const i = makeListInteraction();

    await handleInteraction(i as any, deps);

    expect(i.replies).toHaveLength(1);
    const out = i.replies[0];
    // i18n header (en by default) + grouping by language with human names.
    expect(out).toContain('Available voices:');
    expect(out).toContain('English (US)');
    expect(out).toContain('Português (Portugal)');
    expect(out).toContain('Amy');
    expect(out).toContain('Tugao');
    // The raw id is still present (copy-pasteable for /voice set).
    expect(out).toContain('en_US-amy-medium');
    expect(out).toContain('pt_PT-tugao-medium');
  });

  it('with no installed models replies with the empty-list message', async () => {
    const deps = makeDeps(db, []);
    const i = makeListInteraction();

    await handleInteraction(i as any, deps);

    expect(i.replies).toHaveLength(1);
    // t('voice.listEmpty', 'en') = '(none installed)'
    expect(i.replies[0]).toContain('none installed');
  });
});
