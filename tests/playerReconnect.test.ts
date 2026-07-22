// tests/playerReconnect.test.ts
// Cobertura do caminho de REJOIN MANUAL (ciclo de backoff) das metricas de voz.
//
// Porque um ficheiro separado: o mock partilhado dos outros testes faz
// entersState() resolver sempre, pelo que a recuperacao "soft" no
// handleDisconnect tem sempre sucesso e nunca se chega ao loop tryRejoin().
// Aqui forcamos o oposto: a recuperacao "soft" REJEITA (-> entra no catch) e o
// rejoin manual so volta a Ready a partir da 2a tentativa. Isso obriga o loop de
// backoff a correr MAIS do que uma vez, provando que voiceReconnects conta UMA
// vez (no resultado do loop) e nao por tentativa — a garantia que o item P7.4
// pede ("um ciclo de backoff nao conta a dobrar").
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Controlo partilhado com a factory do mock (vi.hoisted corre antes do vi.mock).
// - readyCalls: conta chamadas a entersState(Ready) — prova que o loop de rejoin
//   correu mais do que uma tentativa.
// - readyNeverResolves: quando true, entersState(Ready) REJEITA SEMPRE, forcando o
//   caminho de FALHA PERMANENTE (soft falha + todas as tentativas de rejoin falham).
const ctrl = vi.hoisted(() => ({ readyCalls: 0, readyNeverResolves: false }));

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
    // - Signalling/Connecting (recuperacao soft): rejeita sempre -> forca o catch.
    // - Ready: por defeito rejeita na 1a chamada do rejoin e resolve na 2a -> o loop
    //   tryRejoin corre 2 tentativas (uma espera de backoff pelo meio) antes de
    //   recuperar. Se ctrl.readyNeverResolves estiver ligado, REJEITA SEMPRE ->
    //   forca o caminho de falha permanente (todas as tentativas de rejoin falham).
    entersState: (_conn: unknown, status: string) => {
      if (status !== 'ready') {
        return Promise.reject(new Error('soft recovery falhou'));
      }
      // Conta SEMPRE a tentativa de Ready (mesmo quando vai rejeitar), para o
      // teste poder afirmar quantas tentativas de rejoin o loop fez.
      ctrl.readyCalls++;
      if (ctrl.readyNeverResolves) {
        return Promise.reject(new Error('ready nunca resolve'));
      }
      return ctrl.readyCalls >= 2 ? Promise.resolve() : Promise.reject(new Error('not ready yet'));
    },
  };
});

import { metrics } from '../src/metrics';
import { GuildVoicePlayer } from '../src/voice/player';
import type { TTSEngine, SynthRequest } from '../src/tts/engine';

function makeConnection() {
  const conn = new EventEmitter() as EventEmitter & {
    subscribe: () => void;
    destroy: () => void;
    rejoin: () => void;
  };
  conn.subscribe = () => {};
  conn.destroy = () => {};
  conn.rejoin = () => {};
  return conn;
}

describe('GuildVoicePlayer — rejoin manual (ciclo de backoff) e metricas', () => {
  beforeEach(() => {
    ctrl.readyCalls = 0;
    ctrl.readyNeverResolves = false;
    metrics.reset();
  });

  // Garante que os fake timers de um teste nao contaminam os de timer real (o
  // teste de rejoin bem-sucedido usa vi.waitFor com timers reais).
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recupera via rejoin apos varias tentativas e conta voiceReconnects UMA so vez', async () => {
    const engine: TTSEngine = { synth: async (req: SynthRequest) => req.text };

    const conn = makeConnection() as any;
    const player = new GuildVoicePlayer(conn, engine, 20, () => {});

    // Uma queda: soft falha -> catch -> tryRejoin corre 2 tentativas (1a falha,
    // 2a recupera). A 1a falha agenda um backoff real (~1s), por isso o waitFor
    // tem timeout folgado.
    conn.emit('disconnected');

    await vi.waitFor(() => expect(metrics.snapshot().voiceReconnects).toBe(1), { timeout: 3000 });

    // Drop conta 1 vez; reconnect conta 1 vez apesar das multiplas tentativas de
    // rejoin no loop de backoff (o sucesso e contado no RESULTADO do loop).
    expect(metrics.snapshot().voiceDrops).toBe(1);
    expect(metrics.snapshot().voiceReconnects).toBe(1);
    // Confirma que o loop correu mesmo mais do que uma tentativa (>= 2 chamadas a
    // entersState(Ready)) — senao isto nao testava o ciclo de backoff.
    expect(ctrl.readyCalls).toBeGreaterThanOrEqual(2);

    player.destroy();
  });

  // REGRESSAO P8.4: caminho de FALHA PERMANENTE. A recuperacao soft falha E todas
  // as tentativas de rejoin manual falham (entersState(Ready) rejeita sempre). O
  // handleDisconnect faz destroy()+onIdle()+return ANTES de incrementar
  // voiceReconnects. Confirma: a queda conta uma vez (voiceDrops===1), nenhuma
  // reconexao e contada (voiceReconnects===0) e o player sai/destrui a ligacao.
  it('falha permanente: esgota todos os rejoins -> drops=1, reconnects=0, sai e destroi', async () => {
    // Fake timers SO neste teste para avancar os backoffs (~1+2+3s) sem esperar
    // tempo real. Construir o player DEPOIS de ligar os fake timers para que o
    // idle timer do construtor tambem seja falso.
    vi.useFakeTimers();
    ctrl.readyNeverResolves = true;

    const engine: TTSEngine = { synth: async (req: SynthRequest) => req.text };

    const conn = makeConnection() as any;
    conn.destroy = vi.fn();
    const onIdle = vi.fn();
    const player = new GuildVoicePlayer(conn, engine, 20, onIdle);

    // Uma queda: soft falha -> catch -> tryRejoin(3) corre 3 tentativas, todas
    // falham (Ready rejeita sempre), com backoffs de ~1s/2s/3s pelo meio.
    conn.emit('disconnected');

    // runAllTimersAsync flusha microtasks entre timers — necessario porque cada
    // backoff so e agendado DEPOIS de uma promessa rejeitada resolver. Avanca todos
    // os backoffs ate o loop esgotar e handleDisconnect resolver.
    await vi.runAllTimersAsync();

    // Queda contada uma vez; NENHUMA reconexao contada (saiu antes do inc).
    expect(metrics.snapshot().voiceDrops).toBe(1);
    expect(metrics.snapshot().voiceReconnects).toBe(0);
    // O player saiu pelo ramo de falha: onIdle() chamado e a ligacao destruida.
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(conn.destroy).toHaveBeenCalled();
    // Prova que o loop esgotou mesmo as 3 tentativas de rejoin.
    expect(ctrl.readyCalls).toBe(3);

    // destroy() e idempotente (this.destroyed guard); seguro de chamar de novo.
    player.destroy();
  });
});
