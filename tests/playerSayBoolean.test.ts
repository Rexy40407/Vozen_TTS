// tests/playerSayBoolean.test.ts
// P18.1 — say() propaga o resultado do enqueue como boolean, para os comandos
// explicitos (/tts, /voice preview) saberem se o pedido REALMENTE entrou na fila
// ou se foi descartado por a fila estar no cap. Antes say() devolvia void e os
// comandos respondiam SEMPRE "queued"/"playing" — enganando o utilizador.
//
// Contrato testado (SINCRONO, so o sinal de fila-cheia):
//   - enfileirou            -> resolve true
//   - fila no cap (descartado) -> resolve false (o log.warn mantem-se)
//   - player destruido      -> resolve false
// NB: say() NAO espera pela reproducao real; synth-skip / ligacao-nao-Ready
// acontecem DEPOIS de say() ter resolvido true (fora de escopo, ver player.ts).
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

describe('GuildVoicePlayer.say() — devolve boolean (P18.1)', () => {
  it('caso normal: resolve true quando enfileira', async () => {
    const engine: TTSEngine = { synth: async (r: SynthRequest) => r.text };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await expect(player.say(req('ola'))).resolves.toBe(true);

    player.destroy();
  });

  it('fila no cap: resolve false (pedido descartado)', async () => {
    // Worker "parqueado": a sintese NUNCA resolve, por isso o primeiro item fica
    // preso em playNext (in-flight) e NAO liberta a fila. Assim conseguimos enche-la
    // ate ao cap de forma deterministica, sem vi.waitFor — o boolean e imediato.
    const engine: TTSEngine = { synth: () => new Promise<string>(() => {}) };

    const conn = makeConnection() as any;
    // queueCap = 1: com um worker in-flight, cabem (1 in-flight + 1 na fila) = 2 a
    // true; o 3o say() ja nao cabe -> false.
    const player = new GuildVoicePlayer(conn, engine, 1, () => {});

    // 1o: dequeued imediatamente para o worker (in-flight) -> true.
    await expect(player.say(req('a'))).resolves.toBe(true);
    // 2o: ocupa a unica vaga da fila (cap=1) -> true.
    await expect(player.say(req('b'))).resolves.toBe(true);
    // 3o: fila cheia -> descartado -> false.
    await expect(player.say(req('c'))).resolves.toBe(false);

    player.destroy();
  });

  it('player destruido: resolve false', async () => {
    const engine: TTSEngine = { synth: async (r: SynthRequest) => r.text };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});
    player.destroy();

    await expect(player.say(req('ola'))).resolves.toBe(false);
  });

  it('streams long text as ordered sentence chunks when explicitly requested', async () => {
    const seen: string[] = [];
    const engine: TTSEngine = {
      synth: async (request) => {
        seen.push(request.text);
        return request.text;
      },
    };
    const player = new GuildVoicePlayer(makeConnection() as any, engine, 20, () => {});

    const first =
      `The first sentence can start playing quickly ${'without waiting '.repeat(9)}`.trim() + '.';
    const second =
      `The second sentence follows afterwards ${'with the same voice '.repeat(8)}`.trim() + '.';
    await expect(player.say({ ...req(`${first} ${second}`), streamSentences: true })).resolves.toBe(
      true,
    );

    await vi.waitFor(() => expect(seen.length).toBe(2));
    expect(seen).toEqual([first, second]);
    player.destroy();
  });
});
