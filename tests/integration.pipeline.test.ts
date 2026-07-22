/**
 * integration.pipeline.test.ts — END-TO-END integration test (P10.2).
 *
 * Unlike the existing suites (which exercise ISOLATED modules or specific
 * branches of the messageHandler), this test walks the COMPLETE CENTRAL PATH
 * of auto-read end to end, with REAL dependencies:
 *
 *   handleMessage (trigger/gating/rate-limit)
 *     -> cleanText        (real cleanup: URL, emoji, mentions)
 *     -> applyPronunciation(real guild dictionary, via SQLite store)
 *     -> isBlocked         (real guild blocklist, via SQLite store)
 *     -> resolveSynth      (detectLang via franc + pickVoice)
 *     -> player.say(req)   (captured by an observable spy)
 *
 * The store is a real SQLite :memory: (initDb), configured with guild_config,
 * blocklist, opt-out and pronunciation according to each case. Only the player (and
 * therefore the real Piper/Discord) is fake: we capture the SynthRequest passed to say()
 * — which carries `text` AND `model` — and that is where we assert "speaks the right text in
 * the right voice". That req is the END of the central pipeline, so the spy is NOT hollow.
 *
 * Pitfalls avoided (why the test is real and does not pass by accident):
 *  - franc needs LONG text: short sentences return '' and would fall into the
 *    fallback. The PT/EN sentences are long and were verified (por/eng).
 *  - fallback contamination: the global fallback is a THIRD language
 *    (de_DE-...), and the guild does not define default_voice. Thus, if detection
 *    failed silently, the voice would fall into `de_` — and the pt_/en_ prefix
 *    assertions would FAIL instead of passing by accident.
 *  - each `it()` uses fresh db + deps (new limiters Map) so there is no
 *    rate-limit or state contamination between cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { handleMessage } from '../src/commands/messageHandler';
import type { BotDeps } from '../src/bot/deps';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { addBlockword } from '../src/store/blocklist';
import { setOptOut } from '../src/store/optout';
import { addUserPronunciation } from '../src/store/pronunciation';

const GUILD = 'g-integration';
const CHAN = 'chan-autoread';
const BOT_ID = 'bot-1';
const USER = 'user-1';

// Models available in the fake "Piper": European PT + EN. Includes pt_ and en_ so
// pickVoice can choose by prefix when detection gets it right.
const AVAILABLE = ['pt_PT-google-medium', 'en_US-amy-medium'];
// GLOBAL fallback deliberately in a THIRD language (German). The guild does NOT
// define default_voice (stays ''), so a failed detection would fall into de_ —
// never into pt_/en_ — making the voice assertions meaningful.
const GLOBAL_FALLBACK = 'de_DE-thorsten-medium';

// ---------------------------------------------------------------------------
// Helpers (same patterns as the messageHandler*.test.ts suites)
// ---------------------------------------------------------------------------

/** deps with an observable FAKE player (say spy) and real store/config. */
function makeDeps(db: Database.Database, say: ReturnType<typeof vi.fn>): BotDeps {
  const players = new Map<string, unknown>();
  players.set(GUILD, { say });
  return {
    client: {
      user: { id: BOT_ID },
      users: { cache: { get: () => undefined } },
    },
    db,
    players,
    limiters: new Map(),
    availableModels: AVAILABLE,
    config: { defaultVoice: GLOBAL_FALLBACK, defaultSpeed: 1.0 },
  } as unknown as BotDeps;
}

/**
 * Auto-read message in the CHAN channel. The handler's `resolveUser`/`resolveChannel`
 * read from these real "guild" caches, so a numeric mention
 * `<@123>` resolves to the displayName defined here — proving the
 * cleanText <-> guild caches integration.
 */
function makeMessage(opts: {
  content: string;
  channelId?: string;
  mention?: boolean;
  replyToBot?: boolean;
}): any {
  const mention = opts.mention ?? false;
  const replyToBot = opts.replyToBot ?? false;
  return {
    author: { bot: false, id: USER },
    guild: {
      members: {
        cache: {
          get: (id: string) => (id === '123' ? { displayName: 'Diogo' } : undefined),
        },
        me: { voice: { channelId: 'vc-1' } },
      },
      channels: {
        cache: {
          get: (id: string) => (id === '456' ? { name: 'geral' } : undefined),
        },
      },
    },
    guildId: GUILD,
    channelId: opts.channelId ?? CHAN,
    content: opts.content,
    member: { voice: { channelId: 'vc-1' }, roles: { cache: { has: () => true } } },
    mentions: {
      has: () => mention,
      repliedUser: replyToBot ? { id: BOT_ID } : null,
    },
    reference: replyToBot ? { messageId: 'msg-ref-1' } : null,
  };
}

// ---------------------------------------------------------------------------

describe('central pipeline — end-to-end integration (real store + fake player)', () => {
  let db: Database.Database;
  let say: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = initDb(':memory:');
    say = vi.fn().mockResolvedValue(undefined);
    // Auto-read enabled in the CHAN channel. Automatic language detection was REMOVED:
    // the voice is ALWAYS the fixed one. We give the guild a pt_ default_voice so the pipeline
    // reads everything in Portuguese (media localization "um link", etc.) predictably.
    setGuildConfig(db, GUILD, {
      autoread: true,
      ttsChannelId: CHAN,
      enabled: true,
      defaultVoice: 'pt_PT-google-medium',
    });
  });

  afterEach(() => {
    db.close();
  });

  // ── 1. PT HAPPY PATH (fixed pt_ voice) ────────────────────────────────────
  it('message in Portuguese -> clean text + FIXED pt_ voice', async () => {
    const deps = makeDeps(db, say);
    const content =
      'bom dia a todos os membros deste servidor espero que estejam todos bem e com muita saude';

    await handleMessage(makeMessage({ content }), deps);

    expect(say).toHaveBeenCalledTimes(1);
    const req = say.mock.calls[0][0];
    // TEXT: no cleanup/pronunciation changes in this case => identical.
    expect(req.text).toBe(content);
    // VOICE: the guild's FIXED voice (pt_), singleVoice (detection removed).
    expect(req.model).toBe('pt_PT-google-medium');
    expect(req.singleVoice).toBe(true);
    expect(req.speed).toBe(1.0);
  });

  // ── 2. Text in ANOTHER language -> stays on the FIXED voice (no detection) ─────────
  it('message in English -> read in the SAME fixed pt_ voice (detection removed)', async () => {
    const deps = makeDeps(db, say);
    const content =
      'good morning to all the members of this server i hope you are all doing well and feeling great';

    await handleMessage(makeMessage({ content }), deps);

    expect(say).toHaveBeenCalledTimes(1);
    const req = say.mock.calls[0][0];
    expect(req.text).toBe(content);
    // No detection: English text comes out in the FIXED pt_ voice (does not change speaker).
    expect(req.model).toBe('pt_PT-google-medium');
    expect(req.singleVoice).toBe(true);
    expect(req.speed).toBe(1.0);
  });

  // ── 3. BLOCKLIST cuts ─────────────────────────────────────────────────────
  it('blocklisted word -> REDACTED from the text, the rest is spoken', async () => {
    addBlockword(db, GUILD, 'spam');
    const deps = makeDeps(db, say);
    const content =
      'isto aqui e claramente spam e nao deve ser lido pelo bot em circunstancia nenhuma hoje';

    await handleMessage(makeMessage({ content }), deps);

    // The message is spoken, but WITHOUT the blocked word.
    expect(say).toHaveBeenCalledTimes(1);
    const spokenText = say.mock.calls[0][0].text as string;
    expect(spokenText).not.toMatch(/\bspam\b/i);
    expect(spokenText).toContain('isto aqui e claramente e');
  });

  it('message that is ONLY the blocked word -> player does NOT receive say()', async () => {
    addBlockword(db, GUILD, 'spam');
    const deps = makeDeps(db, say);

    await handleMessage(makeMessage({ content: 'spam' }), deps);

    expect(say).not.toHaveBeenCalled();
  });

  // ── 4. OPT-OUT cuts passive reading ───────────────────────────────────────
  it('opted-out user -> passive channel reading does NOT speak', async () => {
    setOptOut(db, GUILD, USER);
    const deps = makeDeps(db, say);
    const content =
      'bom dia a todos os membros deste servidor espero que estejam todos bem e com muita saude';

    await handleMessage(makeMessage({ content }), deps);

    expect(say).not.toHaveBeenCalled();
  });

  it('opted-out BUT with an explicit mention of the bot -> still speaks (explicit action)', async () => {
    setOptOut(db, GUILD, USER);
    const deps = makeDeps(db, say);
    const content =
      'bom dia a todos os membros deste servidor espero que estejam todos bem e com muita saude';

    await handleMessage(makeMessage({ content, mention: true }), deps);

    expect(say).toHaveBeenCalledTimes(1);
    const req = say.mock.calls[0][0];
    expect(req.text).toBe(content);
    expect(req.model.startsWith('pt_')).toBe(true);
  });

  // ── 5. Real CLEANUP (URL/emoji/mentions) reaches the player clean ─────────────
  it('URL + emoji + user/channel mention -> player receives the CLEAN TEXT', async () => {
    const deps = makeDeps(db, say);
    // <@123> resolves to "Diogo" and <#456> to "geral" via the guild caches.
    const content = 'olha este link https://exemplo.pt/artigo 🎉 que o <@123> mandou no <#456>';

    await handleMessage(makeMessage({ content }), deps);

    expect(say).toHaveBeenCalledTimes(1);
    const req = say.mock.calls[0][0];
    // URL removed from the body; emoji removed; <@123> -> Diogo; <#456> -> geral. The
    // link announcement is APPENDED at the end and LOCALIZED in the voice (PT text -> pt_ voice
    // -> "um link"). Proves the end-to-end pipeline of localized media.
    expect(req.text).toBe('olha este link que o Diogo mandou no geral um link');
    expect(req.model.startsWith('pt_')).toBe(true);
  });

  // ── 6. Real PRONUNCIATION applied before synth ────────────────────────────
  it("author's PERSONAL pronunciation -> term replaced in the spoken text", async () => {
    addUserPronunciation(db, USER, 'JS', 'JavaScript', 50);
    const deps = makeDeps(db, say);
    const content =
      'eu adoro programar em JS todos os dias da semana porque e muito divertido e produtivo sempre';

    await handleMessage(makeMessage({ content }), deps);

    expect(say).toHaveBeenCalledTimes(1);
    const req = say.mock.calls[0][0];
    // "JS" -> "JavaScript" (pronunciation applied AFTER cleanText, BEFORE synth).
    expect(req.text).toBe(
      'eu adoro programar em JavaScript todos os dias da semana porque e muito divertido e produtivo sempre',
    );
    // Still detects PT after the substitution.
    expect(req.model.startsWith('pt_')).toBe(true);
  });

  // ── 7. PRECEDENCE: personal /pronunciation > built-in slang ───────────────
  it("PERSONAL pronunciation SHADOWS a built-in EN slang (the user's wins)", async () => {
    // 'brb' is built-in slang ("be right back"), but the user redefines it via /pronunciation.
    addUserPronunciation(db, USER, 'brb', 'bora rapaz', 50);
    const deps = makeDeps(db, say);
    const content = 'brb';

    await handleMessage(makeMessage({ content }), deps);

    expect(say).toHaveBeenCalledTimes(1);
    const req = say.mock.calls[0][0];
    // Pronunciation applied BEFORE the built-in: the user's text comes out, NOT "be right back".
    expect(req.text).toBe('bora rapaz');
    expect(req.text).not.toContain('be right back');
  });
});
