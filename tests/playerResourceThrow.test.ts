// tests/playerResourceThrow.test.ts
//
// Regressao (bug-hunt 2026-07): o TAIL do playNext() — createAudioResource() +
// player.play() — corria FORA de qualquer try/catch. Se createAudioResource()
// lancasse SINCRONAMENTE (transcoder/prism a falhar, path invalido nalgumas
// versoes), acontecia o pior cenario possivel:
//   1. `playing` ficava `true` PARA SEMPRE (foi setado antes do await da sintese e
//      nunca era reposto) -> o AudioPlayer nunca mais emite Idle -> cada say()
//      seguinte ve `!this.playing === false` e enfileira SEM arrancar o worker.
//      A guild fica MUDA no canal de voz ate reiniciar o bot. (== o sintoma do
//      incidente que abriu esta sessao, mas por via de codigo.)
//   2. O `void this.playNext()` do call-site rejeita SEM catch -> unhandledRejection.
//
// Este teste prova o comportamento CORRETO: um throw a criar o recurso SALTA o item
// (como um erro de sintese ja fazia) e a fila CONTINUA — o item seguinte toca.
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Fake do @discordjs/voice: createAudioResource LANCA para o path 'BOOM' (simula o
// transcoder a rebentar sincronamente) e funciona para tudo o resto. O player
// auto-emite Idle apos o play() (setTimeout 0), para a fila avancar naturalmente.
vi.mock('@discordjs/voice', async () => {
  const { EventEmitter: EE } = await import('node:events');
  const IDLE = 'idle';
  class FakeAudioPlayer extends EE {
    play(resource: { path: string }): void {
      (globalThis as Record<string, unknown>).__playOrder ??= [];
      ((globalThis as Record<string, unknown>).__playOrder as string[]).push(resource.path);
      setTimeout(() => this.emit(IDLE), 0);
    }
    stop(): void {
      this.emit(IDLE);
    }
  }
  return {
    AudioPlayerStatus: { Idle: IDLE, Playing: 'playing', Buffering: 'buffering' },
    VoiceConnectionStatus: {
      Disconnected: 'disconnected',
      Signalling: 'signalling',
      Connecting: 'connecting',
      Ready: 'ready',
    },
    StreamType: { Arbitrary: 'arbitrary' },
    createAudioPlayer: () => new FakeAudioPlayer(),
    createAudioResource: (path: string) => {
      if (path === 'BOOM') throw new Error('transcoder boom (createAudioResource)');
      return { path };
    },
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

describe('GuildVoicePlayer — throw em createAudioResource nao trava a fila', () => {
  it('salta o item que rebenta a criar o recurso e continua a tocar os seguintes', async () => {
    (globalThis as Record<string, unknown>).__playOrder = [];
    const engine: TTSEngine = {
      synth: (req: SynthRequest) => Promise.resolve(req.text),
    };
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let onIdleCalls = 0;

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {
      onIdleCalls++;
    });

    // O 1o item rebenta a criar o recurso; o 2o e normal.
    await player.say({ text: 'BOOM', model: 'm', speed: 1 });
    await player.say({ text: 'B', model: 'm', speed: 1 });

    // Com o BUG: playing fica preso true -> B nunca arranca -> order === []. Com o
    // FIX: BOOM e saltado e B toca.
    await vi.waitFor(
      () => {
        const order = (globalThis as Record<string, unknown>).__playOrder as string[];
        expect(order).toEqual(['B']);
      },
      { timeout: 1000 },
    );

    // Recuperou totalmente: nao esta preso ativo e o caminho de erro correu.
    expect(player.isActive()).toBe(false);
    expect(onIdleCalls).toBe(0);
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
    player.destroy();
  });
});
