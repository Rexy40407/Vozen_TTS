import { describe, it, expect } from 'vitest';
import {
  evaluateTranscribeStart,
  shouldAutoStop,
  resolveTranscribeLang,
} from '../src/commands/transcribeGate';

// PURE gates for /transcribe (Phase 4). They decide WITHOUT IO whether transcription can
// start and when it should auto-stop — the handler just translates the verdict into a response/action.

describe('evaluateTranscribeStart', () => {
  const ok = {
    canManage: true,
    isPremium: true,
    sidecarAvailable: true,
    botInVoice: true,
    alreadyRunning: false,
    atCapacity: false,
  };

  it('all green -> ok', () => {
    expect(evaluateTranscribeStart(ok)).toBe('ok');
  });

  it('no Manage-Guild -> noManage (authz first)', () => {
    expect(evaluateTranscribeStart({ ...ok, canManage: false })).toBe('noManage');
  });

  it('no Premium -> notPremium', () => {
    expect(evaluateTranscribeStart({ ...ok, isPremium: false })).toBe('notPremium');
  });

  it('sidecar not installed -> unavailable', () => {
    expect(evaluateTranscribeStart({ ...ok, sidecarAvailable: false })).toBe('unavailable');
  });

  it('bot not in the call -> notInVoice', () => {
    expect(evaluateTranscribeStart({ ...ok, botInVoice: false })).toBe('notInVoice');
  });

  it('already running -> alreadyRunning', () => {
    expect(evaluateTranscribeStart({ ...ok, alreadyRunning: true })).toBe('alreadyRunning');
  });

  it('authz beats entitlement: no Manage AND no Premium -> noManage', () => {
    expect(evaluateTranscribeStart({ ...ok, canManage: false, isPremium: false })).toBe('noManage');
  });

  // Plan 029 (ABUSE-01): GLOBAL cap on concurrent STT sessions (all guilds, whole
  // process) — without this, N Premium guilds transcribing at the same time multiply
  // copies of the Whisper model in RAM and can OOM the whole process.
  it('global cap reached -> atCapacity', () => {
    expect(evaluateTranscribeStart({ ...ok, atCapacity: true })).toBe('atCapacity');
  });

  it('already running IN THIS guild beats atCapacity: per-guild state is more specific than the global', () => {
    expect(evaluateTranscribeStart({ ...ok, alreadyRunning: true, atCapacity: true })).toBe(
      'alreadyRunning',
    );
  });

  it('atCapacity only fires after authz/entitlement/availability/voice pass', () => {
    expect(evaluateTranscribeStart({ ...ok, canManage: false, atCapacity: true })).toBe('noManage');
    expect(evaluateTranscribeStart({ ...ok, isPremium: false, atCapacity: true })).toBe(
      'notPremium',
    );
    expect(evaluateTranscribeStart({ ...ok, sidecarAvailable: false, atCapacity: true })).toBe(
      'unavailable',
    );
    expect(evaluateTranscribeStart({ ...ok, botInVoice: false, atCapacity: true })).toBe(
      'notInVoice',
    );
  });
});

describe('shouldAutoStop', () => {
  const consented = (id: string) => id === 'a' || id === 'b';

  it('does not arm before anyone consents (avoids insta-stop at startup)', () => {
    expect(shouldAutoStop(['x', 'y'], consented, false)).toBe(false);
  });

  it('after there is consent: stops when no consented person remains in the call', () => {
    expect(shouldAutoStop(['x', 'y'], consented, true)).toBe(true);
  });

  it('after there is consent: continues while a consented person is in the call', () => {
    expect(shouldAutoStop(['a', 'x'], consented, true)).toBe(false);
  });

  it('call empty of humans -> stops (even if nobody has consented yet)', () => {
    expect(shouldAutoStop([], consented, false)).toBe(true);
  });
});

describe('resolveTranscribeLang', () => {
  it('the language chosen in the command wins over the server locale', () => {
    expect(resolveTranscribeLang('en', 'pt')).toBe('en');
  });
  it('with no choice (null/empty) it falls back to the server locale', () => {
    expect(resolveTranscribeLang(null, 'pt')).toBe('pt');
    expect(resolveTranscribeLang('', 'pt')).toBe('pt');
    expect(resolveTranscribeLang('  ', 'pt')).toBe('pt');
  });
  it('trims and normalizes to lowercase (clean language code)', () => {
    expect(resolveTranscribeLang(' EN ', 'pt')).toBe('en');
  });
});
