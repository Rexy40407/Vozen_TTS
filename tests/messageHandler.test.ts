/**
 * messageHandler.test.ts — branches NOT yet covered by the existing tests
 * (messageHandlerRole.test.ts covers role-gating; messageHandlerOptout.test.ts
 *  covers opt-out and the basic happy path with autoread).
 *
 * Covers:
 *  1. bot → ignored
 *  2. !guild / !guildId → ignored
 *  3. empty content → ignored
 *  4. cfg.enabled === false → ignored
 *  5. no trigger (not an autoread channel, no mention, no reply) → ignored
 *  6. reply to the bot → activated
 *  7. mention of the bot → activated (without autoread)
 *  8. no active player → does not speak
 *  9. rate-limited (ratePerMin = 0) → does not speak
 * 10. empty text after cleanText (emoji only) → does not speak
 * 11. blocklist hit → does not speak
 * 12. happy path (autoread + all ok) → player.say called with the correct text
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { handleMessage } from '../src/commands/messageHandler';
import type { BotDeps } from '../src/bot/deps';
import { metrics } from '../src/metrics';
import { initDb } from '../src/store/db';
import { setGuildConfig } from '../src/store/guildConfig';
import { addBlockword } from '../src/store/blocklist';
import { setNickname } from '../src/store/nickname';
import { setUserVoice } from '../src/store/userVoice';
import { grantUserPremium } from '../src/store/premium';

const GUILD = 'g-main';
const CHAN = 'chan-autoread';
const BOT_ID = 'bot-1';
const USER = 'user-1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    // xsaid: map of the last speaker (shared across calls of the same deps) — without it
    // there is no suppression of consecutive messages.
    lastSpeaker: new Map<string, string>(),
    availableModels: ['en_US-amy-medium'],
    config: { defaultVoice: 'en_US-amy-medium', defaultSpeed: 1.0 },
  } as unknown as BotDeps;
}

/** deps with no player registered */
function makeDepsNoPlayer(db: Database.Database): BotDeps {
  return {
    client: {
      user: { id: BOT_ID },
      users: { cache: { get: () => undefined } },
    },
    db,
    players: new Map(),
    limiters: new Map(),
    availableModels: ['en_US-amy-medium'],
    config: { defaultVoice: 'en_US-amy-medium', defaultSpeed: 1.0 },
  } as unknown as BotDeps;
}

/**
 * Base message: human author, in channel CHAN, with content "ola mundo".
 * opts allow overriding any field.
 */
function makeMessage(
  opts: {
    bot?: boolean;
    guild?: unknown;
    guildId?: string | null;
    channelId?: string;
    content?: string;
    mention?: boolean;
    replyToBot?: boolean;
    attachments?: Array<{ contentType?: string | null; name?: string | null }>;
    displayName?: string;
    authorId?: string;
    botVoiceChannelId?: string;
    authorVoiceChannelId?: string;
  } = {},
): any {
  const mention = opts.mention ?? false;
  const replyToBot = opts.replyToBot ?? false;
  const botVoiceChannelId = opts.botVoiceChannelId ?? 'voice-1';
  const authorVoiceChannelId = opts.authorVoiceChannelId ?? 'voice-1';

  return {
    author: { bot: opts.bot ?? false, id: opts.authorId ?? USER, username: opts.displayName },
    // attachments: a real Collection has .some(); an array works for the mock.
    attachments: opts.attachments,
    guild:
      opts.guild !== undefined
        ? opts.guild
        : {
            // members.me.voice.channelId = voice channel the bot is in (text-in-voice).
            members: {
              cache: { get: () => undefined },
              me: { voice: { channelId: botVoiceChannelId } },
            },
            channels: { cache: { get: () => undefined } },
          },
    guildId: opts.guildId !== undefined ? opts.guildId : GUILD,
    channelId: opts.channelId ?? CHAN,
    content: opts.content !== undefined ? opts.content : 'ola mundo',
    // no role gating in this suite's tests (ttsRoleId = null by default).
    // displayName (server nick) feeds xsaid; omitted -> no name -> no announcement.
    member: {
      displayName: opts.displayName,
      voice: { channelId: authorVoiceChannelId },
      roles: { cache: { has: () => true } },
    },
    mentions: {
      has: () => mention,
      repliedUser: replyToBot ? { id: BOT_ID } : null,
    },
    reference: replyToBot ? { messageId: 'msg-ref-1' } : null,
    // react: used by the rate-limit feedback (🐢). Always present in the mock (the real
    // code calls it best-effort with optional-chaining); tests that don't use it ignore it.
    react: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleMessage — branches not covered by the existing tests', () => {
  let db: Database.Database;
  let say: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = initDb(':memory:');
    // GuildVoicePlayer.say() returns the real synchronous queue-admission result.
    say = vi.fn().mockResolvedValue(true);
    // Base configuration: autoread active on channel CHAN, bot enabled
    setGuildConfig(db, GUILD, {
      autoread: true,
      ttsChannelId: CHAN,
      enabled: true,
    });
  });

  afterEach(() => {
    db.close();
  });

  // ── store cache (plan 010) ────────────────────────────────────────────────
  it('cache write-through: the 2nd message does NOT re-query guild_config', async () => {
    const deps = makeDeps(db, say);
    // 1st message: populates the guild_config cache (and other hot-path tables).
    await handleMessage(makeMessage({ content: 'primeira' }), deps);
    // Spy on the db from here: on the 2nd message guild_config comes from the cache.
    const spy = vi.spyOn(db, 'prepare');
    await handleMessage(makeMessage({ content: 'segunda' }), deps);
    const guildConfigSelects = spy.mock.calls.filter((c) =>
      String(c[0]).includes('FROM guild_config'),
    );
    expect(guildConfigSelects).toHaveLength(0); // served from cache, no SQL
    expect(say).toHaveBeenCalledTimes(2); // both were read
    spy.mockRestore();
  });

  // ── 1. Author is a bot ────────────────────────────────────────────────────
  it('bot message → ignored by default (read_bots OFF)', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ bot: true }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  it('read_bots ON → message from another bot is read', async () => {
    setGuildConfig(db, GUILD, { readBots: true });
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ bot: true, content: 'sou um bot' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('sou um bot');
  });

  it('read_bots ON → Vozen ITSELF is still NOT read (anti-loop)', async () => {
    setGuildConfig(db, GUILD, { readBots: true });
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ bot: true, authorId: BOT_ID, content: 'eco' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  it('human in another voice channel cannot trigger speech', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({ authorVoiceChannelId: 'vc-other', botVoiceChannelId: 'vc-bot' }),
      deps,
    );
    expect(say).not.toHaveBeenCalled();
  });

  // ── text-in-voice: read the text chat inside the bot's voice channel ──────
  it("text-in-voice ON → message in the bot's voice channel is read (even if not the TTS channel)", async () => {
    setGuildConfig(db, GUILD, { textInVoice: true });
    const deps = makeDeps(db, say);
    // Message in a channel (the in-voice chat 'vc-9') != TTS channel (CHAN); the bot is in 'vc-9'.
    await handleMessage(
      makeMessage({
        content: 'olá do chat de voz',
        channelId: 'vc-9',
        authorVoiceChannelId: 'vc-9',
        botVoiceChannelId: 'vc-9',
      }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('olá do chat de voz');
  });

  it("text-in-voice OFF → message in the bot's voice channel is ignored", async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({ content: 'olá', channelId: 'vc-9', botVoiceChannelId: 'vc-9' }),
      deps,
    );
    expect(say).not.toHaveBeenCalled();
  });

  it('text-in-voice ON but message in ANOTHER voice channel → ignored', async () => {
    setGuildConfig(db, GUILD, { textInVoice: true });
    const deps = makeDeps(db, say);
    // Bot in 'vc-9' but the message came from 'vc-outro'.
    await handleMessage(
      makeMessage({ content: 'olá', channelId: 'vc-outro', botVoiceChannelId: 'vc-9' }),
      deps,
    );
    expect(say).not.toHaveBeenCalled();
  });

  // ── 2. No guild ───────────────────────────────────────────────────────────
  it('message.guild is null → ignored', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ guild: null }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  it('message.guildId is null → ignored', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ guildId: null }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 3. Empty content ──────────────────────────────────────────────────────
  it('empty content ("") → ignored', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: '' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 4. Guild kill-switch ──────────────────────────────────────────────────
  it('cfg.enabled === false → ignored (kill-switch)', async () => {
    setGuildConfig(db, GUILD, { enabled: false });
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage(), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 5. No trigger (wrong channel, no mention, no reply) ───────────────────
  it('channel different from autoread and no mention/reply → ignored', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ channelId: 'outro-canal' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 6. Reply to the bot as a trigger ─────────────────────────────────────
  it('reply to the bot in the wrong channel → activated (reply is an explicit trigger)', async () => {
    const deps = makeDeps(db, say);
    // Channel different from autoread, but it's a reply to the bot → should speak
    await handleMessage(makeMessage({ channelId: 'outro-canal', replyToBot: true }), deps);
    expect(say).toHaveBeenCalledTimes(1);
  });

  // ── 7. Mention of the bot as a trigger (without autoread) ─────────────────
  it('mention of the bot outside the autoread channel → activated', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ channelId: 'outro-canal', mention: true }), deps);
    expect(say).toHaveBeenCalledTimes(1);
  });

  // ── 8. No active player in the guild ──────────────────────────────────────
  it('no active player → does not try to speak', async () => {
    const deps = makeDepsNoPlayer(db);
    await handleMessage(makeMessage(), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 9. Rate-limited ───────────────────────────────────────────────────────
  it('rate-limited (ratePerMin = 0) → does not speak, BUT the drop is visible (🐢 + metric)', async () => {
    metrics.reset();
    setGuildConfig(db, GUILD, { ratePerMin: 0 });
    const deps = makeDeps(db, say);
    const msg = makeMessage();
    await handleMessage(msg, deps);
    expect(say).not.toHaveBeenCalled();
    // The drop is no longer silent: reacts with 🐢 and counts the metric.
    expect(msg.react).toHaveBeenCalledWith('🐢');
    expect(metrics.snapshot().messagesRateLimited).toBe(1);
  });

  // ── 9c. ABUSE-02: rate-limit feedback throttled per (guild,user) ─────────
  // DEDICATED author ('user-fb-1') so as not to collide with the cooldown already consumed by
  // test 9 (the RateLimitFeedbackCooldown instance is a module-singleton in
  // messageHandler.ts, shared by all handleMessage calls in the process).
  it('flood rate-limited: only the 1st dropped message reacts with 🐢, the rest stay silent', async () => {
    metrics.reset();
    setGuildConfig(db, GUILD, { ratePerMin: 0 });
    const deps = makeDeps(db, say);
    const msg1 = makeMessage({ authorId: 'user-fb-1' });
    const msg2 = makeMessage({ authorId: 'user-fb-1' });
    const msg3 = makeMessage({ authorId: 'user-fb-1' });

    await handleMessage(msg1, deps);
    await handleMessage(msg2, deps);
    await handleMessage(msg3, deps);

    expect(say).not.toHaveBeenCalled();
    // The metric counts ALL drops — it is not affected by the visible-feedback throttle.
    expect(metrics.snapshot().messagesRateLimited).toBe(3);
    // Only the 1st message reacts; the 2nd and 3rd (same window) stay silent.
    expect(msg1.react).toHaveBeenCalledWith('🐢');
    expect(msg2.react).not.toHaveBeenCalled();
    expect(msg3.react).not.toHaveBeenCalled();
  });

  // ── 9b. Filter order: a NON-readable message does not consume a token ─────
  // Regression: the rate-limit ran BEFORE cleanText/readable-guard, so an
  // emoji/link (which would never be spoken) burned the budget and silenced the next
  // readable message. With 1 token: emoji-only + "ola" -> "ola" MUST be spoken.
  it('emoji-only message does not spend a rate-limit token (the next readable one speaks)', async () => {
    setGuildConfig(db, GUILD, { ratePerMin: 1 });
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: '🎉' }), deps); // non-readable: should not spend a token
    await handleMessage(makeMessage({ content: 'ola' }), deps); // readable: uses the token
    expect(say).toHaveBeenCalledTimes(1);
  });

  // ── 10. Empty text after cleanText ────────────────────────────────────────
  it('content with only emoji (empty after cleanText) → does not speak', async () => {
    const deps = makeDeps(db, say);
    // 🎉 is Extended_Pictographic → cleanText removes it and it becomes ''
    await handleMessage(makeMessage({ content: '🎉' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 10b. Emoji with zero-width components / flags → does not speak ────────
  // Before the fix, ❤️ (U+2764 U+FE0F) and flags left a truthy zero-width residue
  // that passed the `if (!cleaned)` guard → Piper synthesized an empty clip.
  it('content with only ❤️ (VS16) → does not speak', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: '❤️' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  it('content with only a flag 🇦🇩 → does not speak', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: '🇦🇩' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 10c. Punctuation only → does not speak (guard requires a letter/number) ─
  // Isolates the guard change: cleanText('!!!') = '!!!' (truthy), so the old
  // guard `if (!cleaned)` let it through. The new guard requires \p{L}\p{N}.
  it('content with only punctuation ("!!!") → does not speak', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: '!!!' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 10d. Text with digits ("$100") → speaks (contains \p{N}) ──────────────
  it('content with digits ("$100") → speaks (passes the guard)', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: '$100' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
  });

  // ── 11. Blocklist hit → redaction (reads the rest without the word) ───────
  it('blocklist word is REDACTED → speaks the rest without that word', async () => {
    addBlockword(db, GUILD, 'spam');
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'isto é spam aqui' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('isto é aqui');
  });

  it('message that is ONLY the blocked word → does not speak (nothing readable remains)', async () => {
    addBlockword(db, GUILD, 'spam');
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'spam' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  // ── 12. Happy path ────────────────────────────────────────────────────────
  it('happy path (autoread + all ok) → player.say called with the cleaned text', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá mundo' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    // The SynthRequest should contain the cleaned text (without emojis, etc.)
    const req = say.mock.calls[0][0];
    expect(req).toMatchObject({
      text: 'olá mundo',
      model: expect.any(String),
      speed: expect.any(Number),
    });
  });

  // ── GIF attached (no text) → "a gif" ──────────────────────────────────────
  it('.gif attachment without text → player.say with "a gif"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({ content: '', attachments: [{ contentType: 'image/gif', name: 'cat.gif' }] }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('a gif');
  });

  it('attachment detected by .gif in the name (contentType null) → "a gif"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({ content: '', attachments: [{ contentType: null, name: 'boom.GIF' }] }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('a gif');
  });

  it('text + .gif attachment → text followed by "a gif"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({ content: 'olha', attachments: [{ contentType: 'image/gif', name: 'x.gif' }] }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('olha a gif');
  });

  it('png attachment without text → announces "an image" (by type)', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({ content: '', attachments: [{ contentType: 'image/png', name: 'foto.png' }] }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('an image');
  });

  it('multiple attachments without text → "multiple files"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({
        content: '',
        attachments: [
          { contentType: 'image/png', name: 'a.png' },
          { contentType: 'video/mp4', name: 'b.mp4' },
        ],
      }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('multiple files');
  });

  it('link in the text → body + "a link"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olha https://exemplo.com' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('olha a link');
  });

  it('message with only a link → "a link" (empty body)', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'https://exemplo.com' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('a link');
  });

  // ── xsaid (ON by default): "{name} said {message}" ────────────────────────
  it('xsaid ON (default) + name → "{name} said {body}"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá mundo', displayName: 'Alex' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('Alex said olá mundo');
  });

  it('xsaid ON + body is ONLY a blocked word → does not announce an empty "{name} said"', async () => {
    addBlockword(db, GUILD, 'spam');
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'spam', displayName: 'Alex' }), deps);
    expect(say).not.toHaveBeenCalled();
  });

  it('xsaid ON + body with a blocked word → announces only the rest', async () => {
    addBlockword(db, GUILD, 'spam');
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá spam mundo', displayName: 'Alex' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('Alex said olá mundo');
  });

  it('xsaid ON + media → "{name} said {body} {media}"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({
        content: 'olha',
        displayName: 'Alex',
        attachments: [{ contentType: 'image/gif', name: 'x.gif' }],
      }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('Alex said olha a gif');
  });

  it('xsaid ON + only a gif (no body) → "{name} said a gif"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(
      makeMessage({
        content: '',
        displayName: 'Alex',
        attachments: [{ contentType: 'image/gif', name: 'x.gif' }],
      }),
      deps,
    );
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('Alex said a gif');
  });

  it('xsaid OFF → no name prefix (reads only the message)', async () => {
    setGuildConfig(db, GUILD, { xsaid: false });
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá mundo', displayName: 'Alex' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('olá mundo');
  });

  // ── per-user engine: req.engine follows the author's choice ──────────────
  it('user with Piper engine → the message goes out with req.engine="piper"', async () => {
    setUserVoice(db, GUILD, USER, 'en_US-amy-medium', 1, 'piper');
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].engine).toBe('piper');
  });

  it('stored Kokoro on Free → runtime sends the configured free engine', async () => {
    setUserVoice(db, GUILD, USER, 'en_US-amy-medium', 1, 'kokoro');
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].engine).toBe('google');
  });

  it('stored Kokoro with Plus → runtime keeps Kokoro', async () => {
    setUserVoice(db, GUILD, USER, 'en_US-amy-medium', 1, 'kokoro');
    grantUserPremium(db, USER, 30, 'test', Date.now());
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].engine).toBe('kokoro');
  });

  it('user without a defined voice → req.engine undefined (default Google in the router)', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá' }), deps);
    expect(say.mock.calls[0][0].engine).toBeUndefined();
  });

  it('spoiler → content is NOT read, announces "spoiler" (xsaid OFF)', async () => {
    setGuildConfig(db, GUILD, { xsaid: false });
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olha ||o segredo|| aqui' }), deps);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0].text).toBe('olha aqui spoiler');
  });

  // ── xsaid: do not repeat the name on consecutive messages from the same author ─
  it('same author twice in a row → only the 1st gets "{name} said"', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'primeira', displayName: 'Alex' }), deps);
    await handleMessage(makeMessage({ content: 'segunda', displayName: 'Alex' }), deps);
    expect(say).toHaveBeenCalledTimes(2);
    expect(say.mock.calls[0][0].text).toBe('Alex said primeira');
    expect(say.mock.calls[1][0].text).toBe('segunda'); // no prefix
  });

  it('alternating authors (A, B, A) → all announce', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'um', displayName: 'Alex', authorId: 'A' }), deps);
    await handleMessage(makeMessage({ content: 'dois', displayName: 'Bea', authorId: 'B' }), deps);
    await handleMessage(makeMessage({ content: 'tres', displayName: 'Alex', authorId: 'A' }), deps);
    expect(say.mock.calls[0][0].text).toBe('Alex said um');
    expect(say.mock.calls[1][0].text).toBe('Bea said dois');
    expect(say.mock.calls[2][0].text).toBe('Alex said tres'); // A returned after B
  });

  // ── xsaid: sanitized name + nickname (/voice nickname) ────────────────────
  it('name with emojis/symbols is sanitized in the announcement', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá', displayName: '🔥xX_Alex_Xx🔥' }), deps);
    expect(say.mock.calls[0][0].text).toBe('xX Alex Xx said olá');
  });

  it('nickname (/voice nickname) takes priority over the displayName', async () => {
    setNickname(db, GUILD, USER, 'Zé');
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá', displayName: 'ComplicatedName123' }), deps);
    expect(say.mock.calls[0][0].text).toBe('Zé said olá');
  });

  it('name that is 100% emojis (no nickname) → no prefix (nothing readable)', async () => {
    const deps = makeDeps(db, say);
    await handleMessage(makeMessage({ content: 'olá', displayName: '🔥💯✨' }), deps);
    expect(say.mock.calls[0][0].text).toBe('olá');
  });
});
