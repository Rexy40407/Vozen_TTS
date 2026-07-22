// tests/playerCrossKill.test.ts
// REGRESSAO P19.B: um player MORTO nao pode derrubar o seu SUBSTITUTO.
//
// Cenario do bug (cross-player-kill):
//   1. Player A perde a ligacao -> handleDisconnect entra no ramo de rejoin manual
//      (soft falha, tryRejoin(3) corre com backoffs ~1s/2s/3s + entersState(Ready)).
//      Essa janela dura ate ~30s.
//   2. DURANTE essa janela o utilizador corre /join (ou /leave): removePlayer
//      DESTROI A (poe A.destroyed=true) e instala um player B NOVO no slot
//      players['G'].  (removePlayer NAO compara identidade.)
//   3. Quando o tryRejoin de A finalmente desiste (devolve false por A.destroyed),
//      o ramo de falha permanente ANTIGO fazia `destroy(); onIdle();`. O onIdle de A
//      e uma closure keyed por GUILD que faz `removePlayer('G')` -> DESTROI o B NOVO
//      + mata a ligacao nova. Resultado: segundos depois de re-adicionar o bot, ele
//      sai em silencio e mata a sessao acabada de criar.
//
// Este ficheiro reproduz exatamente isso ao nivel do handleDisconnect, usando o
// REAL removePlayer (src/bot/deps) sobre um mapa players PARTILHADO (como em runtime)
// e uma onIdle REAL do mesmo formato do call site (src/commands/index.ts). O /join e
// interposto DENTRO da janela via hook em conn.rejoin (chamado por tryRejoin).
//
// Mock de @discordjs/voice espelha o de playerReconnect.test.ts (caminho de falha
// permanente): soft recovery rejeita sempre, e entersState(Ready) rejeita SEMPRE
// (readyNeverResolves), forcando todos os rejoins a falharem.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const ctrl = vi.hoisted(() => ({ readyCalls: 0, readyNeverResolves: true }));

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
    // Signalling/Connecting (soft): rejeita sempre -> forca o catch.
    // Ready: rejeita SEMPRE (readyNeverResolves) -> todas as tentativas de rejoin
    // do player A falham, obrigando handleDisconnect a chegar ao ramo de desistencia.
    entersState: (_conn: unknown, status: string) => {
      if (status !== 'ready') {
        return Promise.reject(new Error('soft recovery falhou'));
      }
      ctrl.readyCalls++;
      if (ctrl.readyNeverResolves) {
        return Promise.reject(new Error('ready nunca resolve'));
      }
      return Promise.resolve();
    },
  };
});

import { GuildVoicePlayer } from '../src/voice/player';
import { removePlayer } from '../src/bot/deps';
import type { BotDeps } from '../src/bot/deps';
import type { TTSEngine, SynthRequest } from '../src/tts/engine';
import { metrics } from '../src/metrics';

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

const GUILD = 'G';

describe('GuildVoicePlayer — cross-player-kill (player morto nao derruba o substituto)', () => {
  beforeEach(() => {
    ctrl.readyCalls = 0;
    ctrl.readyNeverResolves = true;
    metrics.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('durante a reconexao de A, /join instala B; A desiste sem destruir B', async () => {
    vi.useFakeTimers();

    const engine: TTSEngine = { synth: async (req: SynthRequest) => req.text };

    // Mapa PARTILHADO, como em runtime. Passamos so o que removePlayer usa.
    const players = new Map<string, GuildVoicePlayer>();
    const deps = { players } as unknown as BotDeps;

    // onIdle de A: a MESMA forma do call site (src/commands/index.ts) — keyed por
    // guild, faz removePlayer + destroi a ligacao registada. Com o fix identity-aware
    // esta closure vira no-op quando o mapa ja tem outro player; aqui usamos a forma
    // "keyed por guild" (sem identity check) DE PROPOSITO para provar que a defesa em
    // handleDisconnect (guard `destroyed`) ja chega — se A chamar este onIdle, ele
    // derrubaria B.
    const onIdleA = () => {
      removePlayer(deps, GUILD);
    };

    const connA = makeConnection() as any;
    connA.destroy = vi.fn();
    const playerA = new GuildVoicePlayer(connA, engine, 20, onIdleA);
    players.set(GUILD, playerA);

    // B — o substituto instalado pelo /join. So precisamos de espiar o seu destroy.

    const playerB = { destroy: vi.fn() } as any as GuildVoicePlayer;

    // Interpoe o /join DENTRO da janela de reconexao: na 1a tentativa de rejoin de A,
    // simulamos o utilizador a correr /join -> removePlayer destroi A (A.destroyed=true)
    // e instala B no slot da guild. So dispara uma vez.
    let joined = false;
    connA.rejoin = () => {
      if (joined) return;
      joined = true;
      removePlayer(deps, GUILD); // destroi A
      players.set(GUILD, playerB); // instala B
    };

    // Queda de A: soft falha -> catch -> tryRejoin(3). A 1a chamada a rejoin() dispara
    // o /join (destroi A, instala B). As tentativas seguintes veem A.destroyed=true e
    // tryRejoin devolve false -> ramo de desistencia de A.
    connA.emit('disconnected');
    await vi.runAllTimersAsync();

    // GARANTIA DE REGRESSAO: A morreu, mas B — o substituto — TEM de sobreviver.
    expect(players.get(GUILD)).toBe(playerB); // B ainda registado
    expect(playerB.destroy).not.toHaveBeenCalled(); // A nao derrubou B
  });

  // Unit test do onIdle IDENTITY-AWARE (defesa extra em src/commands/index.ts).
  // NOTA: a closure real e inline e nao-exportada; este teste exercita uma REPLICA
  // com a mesma logica (prova a logica, nao o call site — esse fica coberto pelo
  // teste de regressao acima ao nivel do handleDisconnect).
  it('onIdle identity-aware: no-op quando o mapa ja tem outro player', () => {
    const players = new Map<string, GuildVoicePlayer>();
    const deps = { players } as unknown as BotDeps;

    const a = { destroy: vi.fn() } as any as GuildVoicePlayer;

    const b = { destroy: vi.fn() } as any as GuildVoicePlayer;

    // Replica EXATA da closure passada ao new GuildVoicePlayer em joinUserVoice,
    // capturando `a` como o player desta closure.
    const onIdleA = () => {
      if (players.get(GUILD) !== a) return; // stale: ja substituido
      removePlayer(deps, GUILD);
    };

    // B ja esta no slot (A foi substituido). Chamar a onIdle de A deve ser no-op:
    // NAO remove B nem o destroi.
    players.set(GUILD, b);
    onIdleA();

    expect(players.get(GUILD)).toBe(b);
    expect(b.destroy).not.toHaveBeenCalled();
  });
});
