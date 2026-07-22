import { describe, it, expect, vi } from 'vitest';
import { createErrorReporter, formatErrorMessage } from '../src/errorReporter';

// Typed params (url, opts) for the typecheck: without them .mock.calls is an empty tuple.
// The mock is passed with the cast `as unknown as typeof fetch`, so the shape of opts
// can be the one the test reads (method+body).
function okFetch() {
  return vi.fn(
    async (_url: string, _opts: { method: string; body: string }) =>
      ({ ok: true, status: 204 }) as Response,
  );
}

describe('formatErrorMessage', () => {
  it('includes the context and the stack in a code block', () => {
    const msg = formatErrorMessage(new Error('boom'), 'gateway');
    expect(msg).toContain('gateway');
    expect(msg).toContain('boom');
    expect(msg).toContain('```');
  });

  it('truncates huge contents to fit within the Discord limit', () => {
    const big = new Error('x'.repeat(5000));
    const msg = formatErrorMessage(big, 'ctx');
    expect(msg.length).toBeLessThanOrEqual(1900);
  });

  it('SEC-03: redacts a token shaped like a Discord token', () => {
    // SYNTHETIC token (never a real one): 3 base64url blocks with the typical lengths.
    const fake = `${'A'.repeat(24)}.${'B'.repeat(6)}.${'C'.repeat(27)}`;
    const msg = formatErrorMessage(new Error(`401 ao usar ${fake}`), 'ctx');
    expect(msg).not.toContain(fake);
    expect(msg).toContain('[token-redigido]');
  });

  it('SEC-03: redacts Bearer credentials', () => {
    const msg = formatErrorMessage(new Error('Authorization: Bearer abc.def-123'), 'ctx');
    expect(msg).not.toContain('abc.def-123');
    expect(msg).toContain('Bearer [redigido]');
  });

  it('SEC-03: body limited to 1500 chars before the wrapper', () => {
    const msg = formatErrorMessage(new Error('x'.repeat(5000)), 'ctx');
    // body = 1500; wrapper (header + code fences) is small and fixed
    expect(msg.length).toBeLessThanOrEqual(1500 + 100);
  });

  // Plan 032 (SECRET-03): extends the scrubber beyond the Discord token + Bearer. SYNTHETIC
  // values below (never real) — they only have the SHAPE of a real key/header.
  it('SECRET-03: redacts an OpenAI key (sk-...)', () => {
    const fake = `sk-${'F'.repeat(40)}`;
    const msg = formatErrorMessage(new Error(`401 ao chamar a OpenAI com ${fake}`), 'ctx');
    expect(msg).not.toContain(fake);
    expect(msg).toContain('[chave-redigida]');
  });

  it('SECRET-03: redacts the value of the x-goog-api-key header', () => {
    const fake = `AIzaSyFAKE${'X'.repeat(20)}`;
    const msg = formatErrorMessage(
      new Error(`Google TTS 403: header x-goog-api-key: ${fake} rejeitado`),
      'ctx',
    );
    expect(msg).not.toContain(fake);
    expect(msg).toContain('[chave-redigida]');
  });

  it('SECRET-03: redacts the value of the key= query param (Google REST API)', () => {
    const fake = `AIzaSyQUERYFAKE${'Y'.repeat(15)}`;
    const msg = formatErrorMessage(
      new Error(`GET https://texttospeech.googleapis.com/v1/text:synthesize?key=${fake} falhou`),
      'ctx',
    );
    expect(msg).not.toContain(fake);
    expect(msg).toContain('[chave-redigida]');
  });

  it('SECRET-03: redacts a generic authorization header (non-Bearer, e.g. Basic)', () => {
    const fake = 'ZmFrZTp1c2Vy'; // base64 placeholder, never a real secret
    const msg = formatErrorMessage(new Error(`403: Authorization: Basic ${fake}`), 'ctx');
    expect(msg).not.toContain(fake);
    expect(msg).toContain('[redigido]');
  });

  it('SECRET-03: still redacts Bearer normally (the generic pattern does not regress this)', () => {
    const msg = formatErrorMessage(new Error('Authorization: Bearer abc.def-123'), 'ctx');
    expect(msg).not.toContain('abc.def-123');
    expect(msg).toContain('Bearer [redigido]');
  });
});

describe('createErrorReporter', () => {
  it('no url -> no-op (does not fetch)', async () => {
    const fetchImpl = okFetch();
    const r = createErrorReporter(undefined, fetchImpl as unknown as typeof fetch);
    expect(await r.report(new Error('e'), 'ctx')).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('with url -> sends POST to the webhook with content', async () => {
    const fetchImpl = okFetch();
    const r = createErrorReporter(
      'https://discord.com/api/webhooks/x',
      fetchImpl as unknown as typeof fetch,
    );
    expect(await r.report(new Error('boom'), 'gateway')).toBe(true);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://discord.com/api/webhooks/x');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body).content).toContain('boom');
  });

  it('DEDUP: the same error is only sent ONCE', async () => {
    const fetchImpl = okFetch();
    const r = createErrorReporter('https://wh', fetchImpl as unknown as typeof fetch);
    const err = new Error('repetido');
    await r.report(err, 'ctx');
    await r.report(err, 'ctx');
    await r.report(err, 'ctx');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // 2nd and 3rd suppressed
  });

  it('DIFFERENT errors are both sent', async () => {
    const fetchImpl = okFetch();
    const r = createErrorReporter('https://wh', fetchImpl as unknown as typeof fetch);
    await r.report(new Error('um'), 'ctx');
    await r.report(new Error('dois'), 'ctx');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('network failure -> false, never throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('down');
    });
    const r = createErrorReporter('https://wh', fetchImpl as unknown as typeof fetch);
    expect(await r.report(new Error('e'), 'ctx')).toBe(false);
  });

  // Bug-hunt 2026-07: the hash was marked "seen" BEFORE the send succeeded, so a
  // transient failure lost that error forever within the dedup window. Now, if the
  // send fails, the SAME occurrence can be retried; dedup only sticks after success.
  it('failed send does NOT dedup: the next occurrence retries and once it succeeds starts deduping', async () => {
    let ok = false;
    const fetchImpl = vi.fn(async () => {
      if (!ok) throw new Error('down');
      return { ok: true, status: 204 } as Response;
    });
    const r = createErrorReporter('https://wh', fetchImpl as unknown as typeof fetch);
    const err = new Error('flaky');
    // 1st: network down -> false, and does NOT get stuck as "seen".
    expect(await r.report(err, 'ctx')).toBe(false);
    // 2nd: network recovers -> retries and sends (proof it was not deduped).
    ok = true;
    expect(await r.report(err, 'ctx')).toBe(true);
    // 3rd: now it does dedup (it was already sent successfully).
    expect(await r.report(err, 'ctx')).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('dedup distinguishes different NON-Error rejections (plain objects)', async () => {
    const fetchImpl = okFetch();
    const r = createErrorReporter('https://wh', fetchImpl as unknown as typeof fetch);
    await r.report({ code: 'A', detail: 'um' }, 'ctx');
    await r.report({ code: 'B', detail: 'dois' }, 'ctx');
    // Before: both hashed "[object Object]" and the 2nd was suppressed. Now: 2 sends.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
