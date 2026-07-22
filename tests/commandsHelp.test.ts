import { describe, it, expect, vi } from 'vitest';
import { MessageFlags } from 'discord.js';

// Minimal mock of @discordjs/voice — /help doesn't touch voice, but the commands
// module imports it at the top, so the import needs to resolve (without this
// mock the import of src/commands/index fails before any test runs).
vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: () => ({}),
  getVoiceConnection: () => undefined,
}));

import { handleInteraction, commandDefs } from '../src/commands/index';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';

const GUILD = 'g-help-test';

// /help now responds with an EMBED ({ embeds: [embed] }), not { content }.
// This helper flattens embed.data (title + description + name/value of each field
// + footer) into a single searchable string, so that all the text assertions
// (command list, group headers, tagline, GUARD) keep running over
// `i.replies.join('\n')` as before. If the handler reverts to { content },
// that is captured too.
interface FakeInteraction {
  commandName: string;
  guildId: string;
  replies: string[];
  flags: (number | undefined)[];
  reply: (opts: { content?: string; embeds?: unknown[]; flags?: number }) => Promise<void>;
  isRepliable: () => boolean;
  replied: boolean;
  deferred: boolean;
  // Raw embeds (EmbedBuilder), to exercise the real serialization path
  // (embed.toJSON(), which validates Discord's limits) in a test.
  rawEmbeds: unknown[];
}

// Flattens the `.data` of an EmbedBuilder (or a raw embed) into a searchable string.
function flattenEmbed(embed: unknown): string {
  // EmbedBuilder exposes the data in `.data`; a raw embed is already the object itself.
  const data = (embed as { data?: unknown }).data ?? embed;
  const d = data as {
    title?: string;
    description?: string;
    fields?: { name?: string; value?: string }[];
    footer?: { text?: string };
  };
  const parts: string[] = [];
  if (d.title) parts.push(d.title);
  if (d.description) parts.push(d.description);
  for (const f of d.fields ?? []) {
    if (f.name) parts.push(f.name);
    if (f.value) parts.push(f.value);
  }
  if (d.footer?.text) parts.push(d.footer.text);
  return parts.join('\n');
}

function makeHelpInteraction(): FakeInteraction {
  const replies: string[] = [];
  const flags: (number | undefined)[] = [];
  const rawEmbeds: unknown[] = [];
  return {
    commandName: 'help',
    guildId: GUILD,
    replies,
    flags,
    rawEmbeds,
    replied: false,
    deferred: false,
    isRepliable: () => true,
    reply: async (o: { content?: string; embeds?: unknown[]; flags?: number }) => {
      if (o.content) replies.push(o.content);
      for (const e of o.embeds ?? []) {
        rawEmbeds.push(e);
        replies.push(flattenEmbed(e));
      }
      flags.push(o.flags);
    },
  };
}

// /help now renders via t() in the guild's locale, so it needs deps.db to read
// getGuildConfig(guildId).locale. We use a real in-memory DB.
function makeDeps(): BotDeps {
  return {
    client: { user: { id: 'bot-1' } },
    players: new Map(),
    config: { supportUrl: 'https://discord.gg/test' },
    availableModels: [],
    db: initDb(':memory:'),
  } as unknown as BotDeps;
}

describe('/help — in-app command discovery', () => {
  it('(a) lists key commands from each group (General, Voice, Admin)', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    // one representative of each group + the ones explicitly required by the contract
    expect(text).toContain('/tts'); // General
    expect(text).toContain('/join'); // General
    expect(text).toContain('/invite'); // General
    expect(text).toContain('/help'); // General (self-inclusion)
    expect(text).toContain('/voice'); // Voice
    expect(text).toContain('/setup'); // Admin
    expect(text).toContain('/stats'); // Admin
    expect(text).toContain('/config'); // Admin
  });

  it('(compliance) shows a support/report channel (Discord Developer Policy requirement)', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    // The Developer Policy requires a way to report problems; /help exposes the config URL.
    expect(text).toContain('https://discord.gg/test');
    expect(text.toLowerCase()).toMatch(/report|reportar/);
  });

  it('reflects the /voice subcommands (set, list, preview, opt-out, opt-in)', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    for (const sub of ['set', 'list', 'reset', 'preview', 'opt-out', 'opt-in']) {
      expect(text).toContain(sub);
    }
  });

  it('shows the group headers in ENGLISH by default', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    // default locale 'en' -> headers in English (5 beginner-friendly groups)
    expect(text).toContain('Getting started');
    expect(text).toMatch(/Your voice/);
    expect(text).toContain('Fun');
    expect(text).toContain('Server admin');
    expect(text).toContain('More');
  });

  it('renders the /help chrome in PT when the guild has locale="pt"', async () => {
    const deps = makeDeps();
    setGuildConfig((deps as any).db, GUILD, { locale: 'pt' });
    const i = makeHelpInteraction();
    await handleInteraction(i as any, deps);
    const text = i.replies.join('\n');
    // The chrome (group headers) is what distinguishes EN vs PT.
    expect(text).toContain('Primeiros passos');
    expect(text).toMatch(/A tua voz/);
    // and must NOT contain the English header in this locale
    expect(text).not.toContain('Getting started');
  });

  it('(b) includes the Vozen brand/tagline', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    expect(text).toContain('Vozen');
    expect(text).toMatch(/type it, hear it/i);
  });

  it('recommends /setup as the first step', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    expect(text).toContain('/setup');
  });

  it('(c) the response is ephemeral', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    expect(i.replies.length).toBeGreaterThan(0);
    // all replies from this command must be ephemeral
    for (const f of i.flags) {
      expect(f).toBe(MessageFlags.Ephemeral);
    }
  });

  it('(d) responds with an embed that serializes without violating Discord limits', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    // /help responds with an EmbedBuilder. embed.toJSON() is the REAL send path
    // in discord.js and validates the limits (field name/value non-empty,
    // value <=1024, total <=6000). If any group were empty or huge, this would
    // throw — it guards the embed contract, not just the flattened text.
    expect(i.rawEmbeds.length).toBe(1);
    const embed = i.rawEmbeds[0] as { toJSON: () => { fields?: unknown[] } };
    expect(() => embed.toJSON()).not.toThrow();
    const json = embed.toJSON();
    // quick-start + five groups -> six fields
    expect(json.fields?.length).toBe(6);
  });

  // GUARD: derived from the real commandDefs — every REGISTERED top-level command
  // must appear in /help. If someone adds a new command to commandDefs and forgets
  // to cover it in /help (hardcoded handler), this test breaks. It only passes
  // because the handler builds the text from commandDefs (not hardcoded).
  it('GUARD: every registered top-level command appears in /help', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    for (const def of commandDefs) {
      expect(text, `/${def.name} missing from /help`).toContain('/' + def.name);
    }
  });

  // ── beginner-friendly: quick-start + previously undiscoverable commands ─────────
  it('includes a 3-step quick-start', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    // quick-start title (EN default) + the three step numbers
    expect(text).toMatch(/quick start/i);
    expect(text).toContain('1)');
    expect(text).toContain('2)');
    expect(text).toContain('3)');
    // the first step must tell the user to join voice and run /join
    expect(text).toMatch(/\/join/);
  });

  it('mentions the previously undiscoverable new commands: /joke, /laugh', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    expect(text).toContain('/joke');
    expect(text).toContain('/laugh');
  });

  it('gives at least one concrete example per section', async () => {
    const i = makeHelpInteraction();
    await handleInteraction(i as any, makeDeps());
    const text = i.replies.join('\n');
    // hand-authored concrete examples (not derivable from the descriptions)
    expect(text).toMatch(/\/tts Hello/i);
    expect(text).toMatch(/\/voice set/i);
    expect(text).toMatch(/\/joke /i);
  });
});

describe('/help — command definition', () => {
  it('is registered in commandDefs as a top-level command (NOT admin-only)', () => {
    const def = commandDefs.find((c) => c.name === 'help');
    expect(def).toBeDefined();
    // top-level, any user: no permission restriction by default
    expect(def?.default_member_permissions ?? undefined).toBeUndefined();
  });
});
