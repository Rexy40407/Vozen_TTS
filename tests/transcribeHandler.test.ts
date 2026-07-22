// tests/transcribeHandler.test.ts
//
// Characterizes the LIFECYCLE of the /transcribe session (plan 019): closes the startup
// race (two nearly simultaneous `start` calls), the selfMute inversion (which muted the
// whole guild's TTS), and the EXTERNAL teardown (stopTranscriptionForGuild) called by the
// removePlayer funnel when the bot leaves the call — without it, the Whisper sidecar, the
// speaking listener and the auto-stop interval were left orphaned (guild stuck until restart).
//
// Plan 029 (ABUSE-01/DISCORD-02) adds: the GLOBAL cap on concurrent STT sessions
// (`globalSttSemaphore`, mocked here by a FAKE version but with the same shape —
// `available`/`tryAcquire` — controllable via `h.sttSemaphore.reset(cap)`) and the error
// teardown when the announcement's `channel.send` fails AFTER un-deafening.
//
// Mocks @discordjs/voice (controllable getVoiceConnection + EndBehaviorType, used only
// as a value in transcriptionSession.ts/recorder.ts), the Whisper sidecar (resolveWhisperCmd
// always available) and the WhisperTranscriber (prewarm/transcribe/dispose spies) — the
// real audio CAPTURE never runs in these tests (we don't simulate speech), only the
// startup/stop of the session.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { messageText } from './messagePayload';
import { initDb } from '../src/store/db';
import { grantGuildPremium } from '../src/store/premium';
import { t, DEFAULT_LOCALE } from '../src/i18n/index';
import type { BotDeps } from '../src/bot/deps';

const h = vi.hoisted(() => {
  // Fake of the GLOBAL STT Semaphore: same shape as src/tts/semaphore.ts (available,
  // synchronous tryAcquire returning an IDEMPOTENT release), but with `reset(cap)` so the
  // tests can control the capacity without depending on state left by previous tests.
  const sttSemaphore = {
    permits: 5,
    get available(): number {
      return this.permits;
    },
    tryAcquire(): (() => void) | null {
      if (this.permits <= 0) return null;
      this.permits--;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.permits++;
      };
    },
    reset(cap: number) {
      this.permits = cap;
    },
  };
  return {
    getVoiceConnection: vi.fn(),
    resolveWhisperCmd: vi.fn(),
    transcriberInstances: [] as Array<{
      prewarm: ReturnType<typeof vi.fn>;
      transcribe: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    }>,
    sttSemaphore,
  };
});

// Only what transcribe.ts/transcriptionSession.ts/recorder.ts touch at runtime.
vi.mock('@discordjs/voice', () => ({
  getVoiceConnection: (...args: unknown[]) => h.getVoiceConnection(...args),
  EndBehaviorType: { AfterSilence: 'afterSilence' },
}));

vi.mock('../src/voice/whisperSidecar', () => ({
  resolveWhisperCmd: (...args: unknown[]) => h.resolveWhisperCmd(...args),
  DEFAULT_WHISPER_MODEL: 'base',
}));

vi.mock('../src/voice/whisperTranscriber', () => ({
  WhisperTranscriber: class {
    prewarm = vi.fn();
    transcribe = vi.fn(async () => ({ text: '', lang: 'en' }));
    dispose = vi.fn();
    constructor() {
      h.transcriberInstances.push(this as unknown as (typeof h.transcriberInstances)[number]);
    }
  },
  MAX_CONCURRENT_STT: 1,
  globalSttSemaphore: h.sttSemaphore,
}));

import { handleTranscribe, stopTranscriptionForGuild } from '../src/commands/handlers/transcribe';

// ── fakes ──────────────────────────────────────────────────────────────────────────

function makeVoiceChannel(memberIds: string[]) {
  const members = new Map(memberIds.map((id) => [id, { id, user: { bot: false } }]));
  return { isVoiceBased: () => true, members };
}

function makeConnection() {
  return {
    joinConfig: { channelId: 'VC' },
    rejoin: vi.fn(),
    receiver: { speaking: { on: vi.fn(), off: vi.fn() } },
  };
}

function makeAnnounceMsg(channel: unknown) {
  return {
    edit: vi.fn(async () => {}),
    channel,
    createMessageComponentCollector: () => ({ on: vi.fn(), stop: vi.fn() }),
  };
}

function makeChannel() {
  const channel: {
    isTextBased: () => boolean;
    isDMBased: () => boolean;
    send: ReturnType<typeof vi.fn>;
  } = {
    isTextBased: () => true,
    isDMBased: () => false,
    send: vi.fn(async () => makeAnnounceMsg(channel)),
  };
  return channel;
}

/** Channel whose `send` (the startup announcement) ALWAYS fails — simulates lost SendMessages,
 * rate-limit or network failure (plan 029, part B/DISCORD-02). */
function makeFailingChannel(error: Error = new Error('SendMessages perdido')) {
  const channel: {
    isTextBased: () => boolean;
    isDMBased: () => boolean;
    send: ReturnType<typeof vi.fn>;
  } = {
    isTextBased: () => true,
    isDMBased: () => false,
    send: vi.fn(async () => {
      throw error;
    }),
  };
  return channel;
}

function makeInteraction(opts: {
  guildId: string;
  sub: 'start' | 'stop' | 'revoke';
  channel: ReturnType<typeof makeChannel>;
  voiceMembers?: string[];
}) {
  const replies: string[] = [];
  const voiceChannel = makeVoiceChannel(opts.voiceMembers ?? ['human1']);
  return {
    guildId: opts.guildId,
    user: { id: 'U1' },
    memberPermissions: { has: () => true },
    options: {
      getSubcommand: () => opts.sub,
      getString: () => null,
    },
    reply: vi.fn(async (o: unknown) => {
      replies.push(messageText(o));
    }),
    deferReply: vi.fn(async () => {}),
    editReply: vi.fn(async (o: unknown) => {
      replies.push(messageText(o));
      return {};
    }),
    replies,
    channel: opts.channel,
    guild: {
      channels: { cache: { get: (id: string) => (id === 'VC' ? voiceChannel : undefined) } },
      members: { cache: { get: () => undefined } },
    },
  };
}

let db: Database.Database;

beforeEach(() => {
  h.getVoiceConnection.mockReset();
  h.resolveWhisperCmd.mockReset();
  h.resolveWhisperCmd.mockReturnValue({ exe: 'py', args: ['whisper_sidecar.py'] });
  h.transcriberInstances.length = 0;
  // GENEROUS reset by default: most tests don't test the cap itself and don't always
  // release the session they started — without this, permits would stay stuck between tests.
  // The cap tests (below) call h.sttSemaphore.reset(1) explicitly.
  h.sttSemaphore.reset(5);
  db = initDb(':memory:');
});

afterEach(() => {
  db.close();
  vi.useRealTimers();
});

function makeDeps(guildId: string): BotDeps {
  grantGuildPremium(db, guildId, 30, 'manual', Date.now());
  return { db } as unknown as BotDeps;
}

// ── tests ─────────────────────────────────────────────────────────────────────────

describe('/transcribe — session lifecycle (plan 019)', () => {
  it('start: un-deafens and does NOT stay self-muted (bug: it muted the whole guild TTS)', async () => {
    const guildId = 'g-selfmute';
    const conn = makeConnection();
    h.getVoiceConnection.mockReturnValue(conn);
    const channel = makeChannel();
    const i = makeInteraction({ guildId, sub: 'start', channel });
    const deps = makeDeps(guildId);

    await handleTranscribe(i as any, deps);

    expect(conn.rejoin).toHaveBeenCalledWith({
      channelId: 'VC',
      selfDeaf: false,
      selfMute: false,
    });
    expect(i.replies).toContain(t('stt.started', DEFAULT_LOCALE));
  });

  it('stop: re-deafens, removes the speaking listener and calls dispose() on the transcriber (privacy invariant)', async () => {
    const guildId = 'g-stop';
    const conn = makeConnection();
    h.getVoiceConnection.mockReturnValue(conn);
    const channel = makeChannel();
    const deps = makeDeps(guildId);

    await handleTranscribe(makeInteraction({ guildId, sub: 'start', channel }) as any, deps);
    const transcriber = h.transcriberInstances.at(-1)!;

    await handleTranscribe(makeInteraction({ guildId, sub: 'stop', channel }) as any, deps);

    expect(conn.rejoin).toHaveBeenLastCalledWith({
      channelId: 'VC',
      selfDeaf: true,
      selfMute: false,
    });
    expect(conn.receiver.speaking.off).toHaveBeenCalledWith('start', expect.any(Function));
    expect(transcriber.dispose).toHaveBeenCalledOnce();
  });

  it('stopTranscriptionForGuild (removePlayer funnel): same cleanup, does NOT rejoin (connection already dead) and frees the guild', async () => {
    const guildId = 'g-external-teardown';
    const conn = makeConnection();
    h.getVoiceConnection.mockReturnValue(conn);
    const channel = makeChannel();
    const deps = makeDeps(guildId);

    await handleTranscribe(makeInteraction({ guildId, sub: 'start', channel }) as any, deps);
    const transcriber = h.transcriberInstances.at(-1)!;
    conn.rejoin.mockClear();

    stopTranscriptionForGuild(guildId);

    // voice-left: the connection no longer exists — it must not try to re-deafen on it.
    expect(conn.rejoin).not.toHaveBeenCalled();
    expect(conn.receiver.speaking.off).toHaveBeenCalledWith('start', expect.any(Function));
    expect(transcriber.dispose).toHaveBeenCalledOnce();

    // the guild is now free: a new start does NOT see "already running".
    const i2 = makeInteraction({ guildId, sub: 'start', channel });
    await handleTranscribe(i2 as any, deps);
    expect(i2.replies).not.toContain(t('stt.alreadyRunning', DEFAULT_LOCALE));
    expect(i2.replies).toContain(t('stt.started', DEFAULT_LOCALE));
  });

  it('two parallel start calls for the same guild only register ONE speaking.on listener (startup race)', async () => {
    const guildId = 'g-race';
    const conn = makeConnection();
    h.getVoiceConnection.mockReturnValue(conn);
    const deps = makeDeps(guildId);
    const i1 = makeInteraction({ guildId, sub: 'start', channel: makeChannel() });
    const i2 = makeInteraction({ guildId, sub: 'start', channel: makeChannel() });

    await Promise.all([handleTranscribe(i1 as any, deps), handleTranscribe(i2 as any, deps)]);

    const starts = (conn.receiver.speaking.on as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'start',
    );
    expect(starts).toHaveLength(1);
  });

  it('auto-stop: a call with no humans after 15s triggers cleanup (even without anyone pressing stop)', async () => {
    vi.useFakeTimers();
    const guildId = 'g-autostop';
    const conn = makeConnection();
    h.getVoiceConnection.mockReturnValue(conn);
    const channel = makeChannel();
    const deps = makeDeps(guildId);

    await handleTranscribe(
      makeInteraction({ guildId, sub: 'start', channel, voiceMembers: [] }) as any,
      deps,
    );
    expect(conn.receiver.speaking.off).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(15_000);

    expect(conn.receiver.speaking.off).toHaveBeenCalledWith('start', expect.any(Function));
  });
});

describe('/transcribe start — global STT concurrency cap (plan 029, ABUSE-01)', () => {
  it('cap reached -> atCapacity for a NEW guild; the original guild is unaffected', async () => {
    h.sttSemaphore.reset(1); // only 1 concurrent STT session allowed in the whole process
    const connA = makeConnection();
    const connB = makeConnection();
    const deps = makeDeps('g-cap-a');
    grantGuildPremium(db, 'g-cap-b', 30, 'manual', Date.now());

    h.getVoiceConnection.mockReturnValueOnce(connA);
    const iA = makeInteraction({ guildId: 'g-cap-a', sub: 'start', channel: makeChannel() });
    await handleTranscribe(iA as any, deps);
    expect(iA.replies).toContain(t('stt.started', DEFAULT_LOCALE));

    // 2nd guild, with the global permit exhausted by the 1st: it must be refused, even with
    // Premium+Manage-Guild+sidecar+voice all green.
    h.getVoiceConnection.mockReturnValueOnce(connB);
    const iB = makeInteraction({ guildId: 'g-cap-b', sub: 'start', channel: makeChannel() });
    await handleTranscribe(iB as any, deps);

    expect(iB.replies).toContain(t('stt.atCapacity', DEFAULT_LOCALE));
    expect(connB.rejoin).not.toHaveBeenCalled(); // never got to un-deafen
    expect(connB.receiver.speaking.on).not.toHaveBeenCalled();
  });

  it('stopping the session releases the permit -> the next guild can now start', async () => {
    h.sttSemaphore.reset(1);
    const connA = makeConnection();
    const connB = makeConnection();
    const deps = makeDeps('g-cap-c');
    grantGuildPremium(db, 'g-cap-d', 30, 'manual', Date.now());

    h.getVoiceConnection.mockReturnValueOnce(connA);
    await handleTranscribe(
      makeInteraction({ guildId: 'g-cap-c', sub: 'start', channel: makeChannel() }) as any,
      deps,
    );

    // stops the 1st session -> releases the global permit (stop() doesn't call getVoiceConnection —
    // it uses the connection stored in the active session).
    await handleTranscribe(
      makeInteraction({ guildId: 'g-cap-c', sub: 'stop', channel: makeChannel() }) as any,
      deps,
    );

    h.getVoiceConnection.mockReturnValueOnce(connB);
    const iD = makeInteraction({ guildId: 'g-cap-d', sub: 'start', channel: makeChannel() });
    await handleTranscribe(iD as any, deps);

    expect(iD.replies).not.toContain(t('stt.atCapacity', DEFAULT_LOCALE));
    expect(iD.replies).toContain(t('stt.started', DEFAULT_LOCALE));
  });
});

describe('/transcribe start — error teardown on announcement (plan 029, DISCORD-02)', () => {
  it("announcement's channel.send fails AFTER un-deafening -> re-deafens, removes listener, dispose and releases the permit", async () => {
    h.sttSemaphore.reset(1);
    const guildId = 'g-announce-fail';
    const conn = makeConnection();
    h.getVoiceConnection.mockReturnValue(conn);
    const channel = makeFailingChannel();
    const i = makeInteraction({ guildId, sub: 'start', channel });
    const deps = makeDeps(guildId);

    await handleTranscribe(i as any, deps);

    // plan 029 invariant: if it un-deafened, it MUST deafen again.
    expect(conn.rejoin).toHaveBeenCalledWith({
      channelId: 'VC',
      selfDeaf: false,
      selfMute: false,
    });
    expect(conn.rejoin).toHaveBeenLastCalledWith({
      channelId: 'VC',
      selfDeaf: true,
      selfMute: false,
    });
    // the speaking listener was removed (it doesn't stay stuck listening with no registered session).
    expect(conn.receiver.speaking.off).toHaveBeenCalledWith('start', expect.any(Function));
    // the transcriber (already started/prewarmed) was discarded.
    const transcriber = h.transcriberInstances.at(-1)!;
    expect(transcriber.dispose).toHaveBeenCalledOnce();
    // the reply to the user reflects the failure, not "started".
    expect(i.replies).toContain(t('stt.startFailed', DEFAULT_LOCALE));
    expect(i.replies).not.toContain(t('stt.started', DEFAULT_LOCALE));

    // the global permit was released: a NEW attempt (same guild, channel that no longer
    // fails) can start instead of getting stuck in atCapacity.
    const okChannel = makeChannel();
    const retry = makeInteraction({ guildId, sub: 'start', channel: okChannel });
    await handleTranscribe(retry as any, deps);
    expect(retry.replies).toContain(t('stt.started', DEFAULT_LOCALE));
  });

  it('with no session registered in activeSessions: stopTranscriptionForGuild stays a no-op (no double-release of the permit)', async () => {
    h.sttSemaphore.reset(1);
    const guildId = 'g-announce-fail-2';
    const conn = makeConnection();
    h.getVoiceConnection.mockReturnValue(conn);
    const channel = makeFailingChannel();
    const deps = makeDeps(guildId);

    await handleTranscribe(makeInteraction({ guildId, sub: 'start', channel }) as any, deps);

    // the session never reached activeSessions -> stopTranscriptionForGuild is a no-op (idempotent,
    // must not blow up nor over-release the permit).
    expect(() => stopTranscriptionForGuild(guildId)).not.toThrow();
    expect(h.sttSemaphore.available).toBe(1); // still released, didn't go negative
  });
});
