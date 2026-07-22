import { describe, expect, it } from 'vitest';
import { rustVoiceOwnsAutoRead, rustVoiceOwnsCommand } from '../src/migration/rustVoiceAuthority';

describe('Rust core voice migration ownership', () => {
  it('is off unless explicitly enabled and only yields the promoted command set', () => {
    expect(rustVoiceOwnsCommand('tts')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'yes')).toBe(false);
    expect(rustVoiceOwnsCommand('tts', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('join', ' TRUE ')).toBe(true);
    expect(rustVoiceOwnsCommand('shut-up', 'true')).toBe(true);
    expect(rustVoiceOwnsCommand('voice', 'true')).toBe(false);
    expect(rustVoiceOwnsCommand('queue', 'true')).toBe(false);
  });

  it('keeps Node message ownership unless both explicit migration flags are set', () => {
    expect(rustVoiceOwnsAutoRead()).toBe(false);
    expect(rustVoiceOwnsAutoRead('true', 'yes')).toBe(false);
    expect(rustVoiceOwnsAutoRead('false', 'true')).toBe(false);
    expect(rustVoiceOwnsAutoRead(' TRUE ', ' true ')).toBe(true);
  });
});
