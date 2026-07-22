// tests/playerIsActive.test.ts
// P18.3 — isActive() e um predicado LEVE que diz se o player tem algo a decorrer:
// esta a tocar (playing) OU tem itens na fila (queue.size() > 0). O /skip usa-o
// para distinguir "nada a tocar" de "saltei" — em vez de fingir sempre que saltou.
//
// Contrato testado:
//   - player recem-criado, sem fila            -> false
//   - com um item in-flight (playing=true)     -> true
// NB: para manter playing=true de forma deterministica usamos um engine cuja
// sintese NUNCA resolve (mesmo truque do teste "fila no cap" em playerSayBoolean):
// apos `await say()`, playNext() ja correu ate ao `await synth` e marcou
// playing=true, mas nunca avanca para Idle.
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Mesmo mock de @discordjs/voice dos outros testes de player.
vi.mock('@discordjs/voice', async () => {
  const { EventEmitter: EE } = await import('node:events');
  const IDLE = 'idle';
  class FakeAudioPlayer extends EE {
    play(): void {
      setTimeout(() => this.emit(IDLE), 0);
    }
    stop(): void {
      this.emit(IDLE);
    }
  }
  return {
    AudioPlayerStatus: { Idle: IDLE },
    VoiceConnectionStatus: {
      Disconnected: 'disconnected',
      Signalling: 'signalling',
      Connecting: 'connecting',
      Ready: 'ready',
    },
    StreamType: { Arbitrary: 'arbitrary' },
    createAudioPlayer: () => new FakeAudioPlayer(),
    createAudioResource: (path: string) => ({ path }),
    entersState: () => Promise.resolve(),
  };
});

import { GuildVoicePlayer } from '../src/voice/player';
import type { TTSEngine, SynthRequest } from '../src/tts/engine';

function makeConnection() {
  const conn = new EventEmitter() as EventEmitter & {
    subscribe: () => void;
    destroy: () => void;
  };
  conn.subscribe = () => {};
  conn.destroy = () => {};
  return conn;
}

const req = (text: string): SynthRequest => ({ text, model: 'm', speed: 1 });

describe('GuildVoicePlayer.isActive() (P18.3)', () => {
  it('player recem-criado sem fila -> false', () => {
    const engine: TTSEngine = { synth: async (r: SynthRequest) => r.text };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    expect(player.isActive()).toBe(false);

    player.destroy();
  });

  it('com um item a tocar (playing=true) -> true', async () => {
    // Sintese que NUNCA resolve: o item fica in-flight em playNext (playing=true)
    // sem nunca chegar a Idle. Deterministico, sem timers.
    const engine: TTSEngine = { synth: () => new Promise<string>(() => {}) };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await player.say(req('a'));
    expect(player.isActive()).toBe(true);

    player.destroy();
  });
});
