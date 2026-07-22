// tests/registerState.test.ts — the global PUT of commands only when they CHANGE (fingerprint).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  commandsFingerprint,
  shouldSkipRegister,
  saveRegisterState,
} from '../src/bot/registerCommands';

describe('commandsFingerprint', () => {
  it('is stable for the same content and changes when the defs change', () => {
    const a = [{ name: 'tts', options: [{ name: 'text' }] }];
    const b = [{ name: 'tts', options: [{ name: 'text' }, { name: 'novo' }] }];
    expect(commandsFingerprint(a)).toBe(commandsFingerprint(structuredClone(a)));
    expect(commandsFingerprint(a)).not.toBe(commandsFingerprint(b));
    expect(commandsFingerprint(a)).toMatch(/^[0-9a-f]{40}$/); // sha1 hex
  });
});

describe('shouldSkipRegister / saveRegisterState', () => {
  let dir: string;
  let stateFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'register-state-'));
    stateFile = join(dir, 'sub', 'commands-state.json'); // subfolder: tests the mkdir
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('no saved state -> does NOT skip (registers)', () => {
    expect(shouldSkipRegister(stateFile, 'client-1', 'fp-abc')).toBe(false);
  });

  it('saved state with the SAME clientId+fingerprint -> skips', () => {
    saveRegisterState(stateFile, 'client-1', 'fp-abc');
    expect(shouldSkipRegister(stateFile, 'client-1', 'fp-abc')).toBe(true);
  });

  it('different fingerprint (commands changed) -> does NOT skip', () => {
    saveRegisterState(stateFile, 'client-1', 'fp-abc');
    expect(shouldSkipRegister(stateFile, 'client-1', 'fp-DIFERENTE')).toBe(false);
  });

  it('different clientId (new app — e.g. account migration) -> does NOT skip', () => {
    saveRegisterState(stateFile, 'client-1', 'fp-abc');
    expect(shouldSkipRegister(stateFile, 'client-2', 'fp-abc')).toBe(false);
  });

  it('corrupted state -> does NOT skip (registers) instead of blowing up', () => {
    writeFileSync(join(dir, 'corrupto.json'), '{nao é json');
    expect(shouldSkipRegister(join(dir, 'corrupto.json'), 'client-1', 'fp-abc')).toBe(false);
  });
});
