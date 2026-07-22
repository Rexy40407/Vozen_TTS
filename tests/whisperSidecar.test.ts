import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { resolveWhisperCmd, DEFAULT_WHISPER_MODEL } from '../src/voice/whisperSidecar';

// Resolution of the Whisper sidecar command (STT). `exists` is injectable so it doesn't depend on the venv.
// Paths built with join() to match the platform (Windows uses '\\', Linux '/').
const CWD = join('/', 'proj');
const PY_LINUX = join(CWD, 'tools', 'whisper-venv', 'bin', 'python');
const PY_WIN = join(CWD, 'tools', 'whisper-venv', 'Scripts', 'python.exe');
const SCRIPT = join(CWD, 'tools', 'whisper_sidecar.py');

describe('resolveWhisperCmd', () => {
  it('venv (bin/python) + script present -> command with --model', () => {
    const cmd = resolveWhisperCmd('base', {
      cwd: CWD,
      exists: (p) => p === PY_LINUX || p === SCRIPT,
    });
    expect(cmd).not.toBeNull();
    expect(cmd!.exe).toBe(PY_LINUX);
    expect(cmd!.args).toEqual([SCRIPT, '--model', 'base']);
  });

  it('Windows venv (Scripts/python.exe) is detected too', () => {
    const cmd = resolveWhisperCmd('tiny', {
      cwd: CWD,
      exists: (p) => p === PY_WIN || p === SCRIPT,
    });
    expect(cmd!.exe).toBe(PY_WIN);
    expect(cmd!.args[2]).toBe('tiny');
  });

  it('no venv -> null (STT inert)', () => {
    expect(resolveWhisperCmd('base', { cwd: CWD, exists: (p) => p === SCRIPT })).toBeNull();
  });

  it('no script -> null', () => {
    expect(resolveWhisperCmd('base', { cwd: CWD, exists: (p) => p === PY_LINUX })).toBeNull();
  });

  it('default model is base', () => {
    expect(DEFAULT_WHISPER_MODEL).toBe('base');
    const cmd = resolveWhisperCmd(undefined, {
      cwd: CWD,
      exists: (p) => p === PY_LINUX || p === SCRIPT,
    });
    expect(cmd!.args).toContain('base');
  });
});
