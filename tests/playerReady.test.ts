// tests/playerReady.test.ts
// Cobertura da robustez P13.1: playNext() so deve tocar DEPOIS de a
// VoiceConnection estar Ready. Numa ligacao lenta / 1a fala a conexao pode estar
// em signalling/connecting; tocar nesse instante manda o audio para o vazio (sem
// som e sem erro). A correcao aguarda entersState(Ready, timeout) antes do play().
//
// Porque um ficheiro separado: controlamos entersState(Ready) via vi.hoisted para
// simular (a) rejeicao por timeout e (b) resolucao apos ficar Ready, sem afetar os
// outros testes (playerFifo resolve sempre; playerReconnect nunca chama say()).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Controlo partilhado com a factory do mock (vi.hoisted corre antes do vi.mock).
// - readyBehavior: 'resolve' -> Ready resolve logo (caminho feliz / ja Ready);
//                  'rejectOnce' -> 1a chamada REJEITA (timeout), seguintes resolvem
//                  (simula "so toca depois de ficar Ready");
//                  'rejectAlways' -> REJEITA sempre (timeout permanente -> salta).
// - readyCalls: quantas vezes entersState(Ready) foi chamado.
const ctrl = vi.hoisted(() => ({
  readyBehavior: 'resolve' as 'resolve' | 'rejectOnce' | 'rejectAlways',
  readyCalls: 0,
}));

vi.mock('@discordjs/voice', async () => {
  const { EventEmitter: EE } = await import('node:events');
  const IDLE = 'idle';
  class FakeAudioPlayer extends EE {
    play(resource: { path: string }): void {
      (globalThis as Record<string, unknown>).__playOrder ??= [];
      ((globalThis as Record<string, unknown>).__playOrder as string[]).push(resource.path);
      // Termina o "audio" no proximo tick -> dispara Idle -> playNext() drena o
      // item seguinte, imitando o ciclo real.
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
    entersState: (_conn: unknown, status: string) => {
      // So o caminho Ready do playNext e interessante aqui. Outros estados
      // (usados pelo handleDisconnect) nao sao exercitados nestes testes.
      if (status !== 'ready') {
        return Promise.resolve();
      }
      ctrl.readyCalls++;
      if (ctrl.readyBehavior === 'rejectAlways') {
        return Promise.reject(new Error('timeout: nao ficou Ready'));
      }
      if (ctrl.readyBehavior === 'rejectOnce') {
        return ctrl.readyCalls >= 2
          ? Promise.resolve()
          : Promise.reject(new Error('timeout: nao ficou Ready (1a)'));
      }
      return Promise.resolve();
    },
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

const engine: TTSEngine = { synth: async (req: SynthRequest) => req.text };

describe('GuildVoicePlayer — espera Ready antes de play() (P13.1)', () => {
  beforeEach(() => {
    ctrl.readyBehavior = 'resolve';
    ctrl.readyCalls = 0;
    (globalThis as Record<string, unknown>).__playOrder = [];
  });

  it('ja Ready: toca imediatamente (caminho feliz, sem regressao)', async () => {
    ctrl.readyBehavior = 'resolve';

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await player.say({ text: 'ola', model: 'm', speed: 1 });

    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toEqual(['ola']);
      },
      { timeout: 1000 },
    );
    // Confirma que passou mesmo pela espera de Ready antes de tocar.
    expect(ctrl.readyCalls).toBeGreaterThanOrEqual(1);

    player.destroy();
  });

  it('so toca depois de Ready: 1a espera rejeita (timeout) -> salta; 2o item toca quando Ready', async () => {
    // 1a chamada a entersState(Ready) REJEITA (ligacao ainda em signalling ->
    // timeout): o 1o item NAO deve tocar (sem audio para o vazio). A conexao fica
    // Ready a seguir -> o 2o item toca. Prova: __playOrder === ['segundo'].
    ctrl.readyBehavior = 'rejectOnce';

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    await Promise.all([
      player.say({ text: 'primeiro', model: 'm', speed: 1 }),
      player.say({ text: 'segundo', model: 'm', speed: 1 }),
    ]);

    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toEqual(['segundo']);
      },
      { timeout: 1000 },
    );

    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', onUnhandled);

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // 1o saltado (nao ficou Ready), 2o tocou -> a fila continuou sem crashar.
    expect(order).toEqual(['segundo']);
    expect(unhandled).toEqual([]);
    // Logou o aviso de "nao ficou Ready" (log.warn escreve em console.error).
    expect(warnSpy).toHaveBeenCalled();
    // Duas tentativas de Ready: uma por item.
    expect(ctrl.readyCalls).toBe(2);

    warnSpy.mockRestore();
    player.destroy();
  });

  it('timeout permanente: nunca toca, loga, nao crasha, sem unhandledRejection', async () => {
    ctrl.readyBehavior = 'rejectAlways';

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 60_000, () => {});

    await player.say({ text: 'so-um', model: 'm', speed: 1 });

    // Espera que a espera de Ready seja tentada e a fila seja drenada (sem tocar).
    await vi.waitFor(() => expect(ctrl.readyCalls).toBeGreaterThanOrEqual(1), {
      timeout: 1000,
    });
    await new Promise((r) => setTimeout(r, 10));
    process.off('unhandledRejection', onUnhandled);

    const order = (globalThis as Record<string, unknown>).__playOrder as string[];
    // NUNCA tocou: audio nao foi para o vazio.
    expect(order).toEqual([]);
    // Logou o aviso e nao houve rejeicao nao tratada.
    expect(warnSpy).toHaveBeenCalled();
    expect(unhandled).toEqual([]);

    warnSpy.mockRestore();
    player.destroy();
  });
});
