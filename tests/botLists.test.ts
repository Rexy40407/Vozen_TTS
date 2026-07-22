import { describe, it, expect, vi } from 'vitest';
import {
  postTopggStats,
  startBotListUpdater,
  syncTopggCommands,
  type TopggCommand,
} from '../src/botLists';

// Typed params (url, opts) for the typecheck: without them .mock.calls is an empty tuple.
// The mock is passed with the cast `as unknown as typeof fetch`, so opts can have the
// shape the test reads (method+headers+body).
function okFetch() {
  return vi.fn(
    async (
      _url: string,
      _opts: { method: string; headers: { Authorization: string }; body: string },
    ) => ({ ok: true, status: 200 }) as Response,
  );
}

describe('postTopggStats', () => {
  it('PATCHes the Top.gg v1 project endpoint with Bearer auth and server_count', async () => {
    const fetchImpl = okFetch();
    const ok = await postTopggStats('bot-123', 'tok-abc', 42, fetchImpl as unknown as typeof fetch);
    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://top.gg/api/v1/projects/@me/metrics');
    expect(opts.method).toBe('PATCH');
    expect(opts.headers.Authorization).toBe('Bearer tok-abc');
    expect(JSON.parse(opts.body)).toEqual({ server_count: 42 });
  });

  it('falls back to the legacy endpoint only when v1 is unavailable', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const ok = await postTopggStats('bot-123', 'tok-abc', 42, fetchImpl as typeof fetch);

    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('https://top.gg/api/bots/bot-123/stats');
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'tok-abc' },
    });
  });

  it('does not hide v1 authentication or validation errors behind the legacy API', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400 }) as Response);
    const ok = await postTopggStats('bot-123', 'bad-token', 42, fetchImpl as typeof fetch);
    expect(ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('non-2xx HTTP -> false (does not throw)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401 }) as Response);
    const ok = await postTopggStats('b', 't', 1, fetchImpl as unknown as typeof fetch);
    expect(ok).toBe(false);
  });

  it('network error -> false (never throws)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const ok = await postTopggStats('b', 't', 1, fetchImpl as unknown as typeof fetch);
    expect(ok).toBe(false);
  });
});

describe('syncTopggCommands', () => {
  const commands: TopggCommand[] = [
    { name: 'tts', description: 'Read text out loud', type: 1 },
    { name: 'Translate', type: 3 },
  ];

  it('overwrites the Top.gg v1 command list with Discord command JSON', async () => {
    const fetchImpl = okFetch();
    const ok = await syncTopggCommands('tok-abc', commands, fetchImpl as unknown as typeof fetch);
    expect(ok).toBe(true);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://top.gg/api/v1/projects/@me/commands');
    expect(opts.method).toBe('PUT');
    expect(opts.headers.Authorization).toBe('Bearer tok-abc');
    expect(JSON.parse(opts.body)).toEqual(commands);
  });

  it('never sends owner-only commands when the caller passes only public definitions', async () => {
    const fetchImpl = okFetch();
    await syncTopggCommands('tok', commands, fetchImpl as unknown as typeof fetch);
    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body) as TopggCommand[];
    expect(body.some((command) => command.name === 'vozen-grant')).toBe(false);
  });
});

describe('startBotListUpdater', () => {
  it('no token -> no-op (does not publish, stop() safe)', () => {
    const fetchImpl = okFetch();
    const stop = startBotListUpdater({
      botId: 'b',
      token: undefined,
      serverCount: () => 5,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      setIntervalImpl: () => 0 as unknown as ReturnType<typeof setInterval>,
      clearIntervalImpl: () => {},
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('with token -> publishes NOW and registers the interval; stop() cancels it', () => {
    const fetchImpl = okFetch();
    let intervalFn: (() => void) | null = null;
    const cleared: number[] = [];
    const stop = startBotListUpdater({
      botId: 'b',
      token: 'tok',
      serverCount: () => 7,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      setIntervalImpl: (fn) => {
        intervalFn = fn;
        return 99 as unknown as ReturnType<typeof setInterval>;
      },
      clearIntervalImpl: (h) => cleared.push(h as unknown as number),
    });
    // Immediate publish.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // The interval tick publishes again with the CURRENT count.
    intervalFn!();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    stop();
    expect(cleared).toEqual([99]);
  });
});
