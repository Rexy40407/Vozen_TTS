// tests/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatLine, log } from '../src/logging/logger';

// ---------------------------------------------------------------------------
// 1. formatLine — pure, no real clock
// ---------------------------------------------------------------------------
describe('formatLine', () => {
  it('includes the ISO timestamp of the given date', () => {
    const d = new Date('2026-06-30T05:00:00.000Z');
    expect(formatLine(d, 'info', 'olá')).toContain('2026-06-30T05:00:00.000Z');
  });

  it('includes the level in uppercase', () => {
    const d = new Date('2026-06-30T05:00:00.000Z');
    expect(formatLine(d, 'warn', 'x')).toContain('[WARN]');
    expect(formatLine(d, 'error', 'x')).toContain('[ERROR]');
    expect(formatLine(d, 'debug', 'x')).toContain('[DEBUG]');
    expect(formatLine(d, 'info', 'x')).toContain('[INFO]');
  });

  it('includes the message', () => {
    const d = new Date('2026-06-30T05:00:00.000Z');
    expect(formatLine(d, 'info', 'mensagem teste')).toContain('mensagem teste');
  });

  it('full format: <iso> [LEVEL] message', () => {
    const d = new Date('2026-06-30T05:00:00.000Z');
    expect(formatLine(d, 'info', 'hello')).toBe('2026-06-30T05:00:00.000Z [INFO] hello');
  });
});

// ---------------------------------------------------------------------------
// 2. Level filtering (reads process.env.LOG_LEVEL dynamically)
// ---------------------------------------------------------------------------
describe('log — level filtering', () => {
  const saved = process.env.LOG_LEVEL;
  let spyLog: ReturnType<typeof vi.spyOn>;
  let spyErr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (saved === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = saved;
  });

  it('debug is suppressed when LOG_LEVEL=info (default)', () => {
    process.env.LOG_LEVEL = 'info';
    log.debug('nao deve aparecer');
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyErr).not.toHaveBeenCalled();
  });

  it('debug is suppressed when LOG_LEVEL is not set (default=info)', () => {
    delete process.env.LOG_LEVEL;
    log.debug('silencioso');
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyErr).not.toHaveBeenCalled();
  });

  it('info passes when LOG_LEVEL=info', () => {
    process.env.LOG_LEVEL = 'info';
    log.info('mensagem info');
    expect(spyLog).toHaveBeenCalledOnce();
    expect(spyLog.mock.calls[0][0]).toContain('[INFO]');
    expect(spyLog.mock.calls[0][0]).toContain('mensagem info');
  });

  it('warn passes on the default (LOG_LEVEL=info)', () => {
    process.env.LOG_LEVEL = 'info';
    log.warn('aviso');
    expect(spyErr).toHaveBeenCalledOnce();
    expect(spyErr.mock.calls[0][0]).toContain('[WARN]');
  });

  it('error passes on the default', () => {
    process.env.LOG_LEVEL = 'info';
    log.error('erro');
    expect(spyErr).toHaveBeenCalledOnce();
    expect(spyErr.mock.calls[0][0]).toContain('[ERROR]');
  });

  it('debug appears when LOG_LEVEL=debug', () => {
    process.env.LOG_LEVEL = 'debug';
    log.debug('debug visivel');
    expect(spyLog).toHaveBeenCalledOnce();
    expect(spyLog.mock.calls[0][0]).toContain('[DEBUG]');
  });

  it('info is suppressed when LOG_LEVEL=warn', () => {
    process.env.LOG_LEVEL = 'warn';
    log.info('info silencioso');
    expect(spyLog).not.toHaveBeenCalled();
  });

  it('warn passes when LOG_LEVEL=warn', () => {
    process.env.LOG_LEVEL = 'warn';
    log.warn('aviso visivel');
    expect(spyErr).toHaveBeenCalledOnce();
  });

  it('error passes even when LOG_LEVEL=warn', () => {
    process.env.LOG_LEVEL = 'warn';
    log.error('erro visivel');
    expect(spyErr).toHaveBeenCalledOnce();
  });

  it('invalid LOG_LEVEL value falls back to info (debug suppressed)', () => {
    process.env.LOG_LEVEL = 'bogus';
    log.debug('silencioso');
    expect(spyLog).not.toHaveBeenCalled();
    log.info('visivel');
    expect(spyLog).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 3. warn and error write to console.error; debug and info to console.log
// ---------------------------------------------------------------------------
describe('log — correct sink', () => {
  const saved = process.env.LOG_LEVEL;
  let spyLog: ReturnType<typeof vi.spyOn>;
  let spyErr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.LOG_LEVEL = 'debug'; // see everything
    spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (saved === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = saved;
  });

  it('debug → console.log', () => {
    log.debug('d');
    expect(spyLog).toHaveBeenCalledOnce();
    expect(spyErr).not.toHaveBeenCalled();
  });

  it('info → console.log', () => {
    log.info('i');
    expect(spyLog).toHaveBeenCalledOnce();
    expect(spyErr).not.toHaveBeenCalled();
  });

  it('warn → console.error', () => {
    log.warn('w');
    expect(spyErr).toHaveBeenCalledOnce();
    expect(spyLog).not.toHaveBeenCalled();
  });

  it('error → console.error', () => {
    log.error('e');
    expect(spyErr).toHaveBeenCalledOnce();
    expect(spyLog).not.toHaveBeenCalled();
  });

  it('passes extra arguments to the sink (for stack traces)', () => {
    const err = new Error('boom');
    log.error('detalhe', err);
    expect(spyErr).toHaveBeenCalledOnce();
    // first arg is the formatted line, second is the Error
    expect(spyErr.mock.calls[0][1]).toBe(err);
  });

  it('log.warn passes extra args', () => {
    const obj = { x: 1 };
    log.warn('detalhe', obj);
    expect(spyErr.mock.calls[0][1]).toBe(obj);
  });
});
