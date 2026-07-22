// tests/shutdown.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { shutdown, installSignalHandlers } from '../src/bot/shutdown';
import type { GuildVoicePlayer } from '../src/voice/player';
import type Database from 'better-sqlite3';

function fakePlayer() {
  return { destroy: vi.fn() } as unknown as GuildVoicePlayer;
}

function fakeDb() {
  // Modela a propriedade `open` do better-sqlite3: flip para false ao fechar.
  const db = {
    open: true,
    close: vi.fn(function (this: { open: boolean }) {
      this.open = false;
    }),
  };
  return db as unknown as Database.Database & { open: boolean; close: ReturnType<typeof vi.fn> };
}

describe('shutdown', () => {
  it('destroi todos os players e fecha a DB', () => {
    const p1 = fakePlayer();
    const p2 = fakePlayer();
    const players = new Map<string, GuildVoicePlayer>([
      ['g1', p1],
      ['g2', p2],
    ]);
    const db = fakeDb();

    shutdown({ players, db });

    expect(p1.destroy).toHaveBeenCalledTimes(1);
    expect(p2.destroy).toHaveBeenCalledTimes(1);
    expect(db.close).toHaveBeenCalledTimes(1);
    // O mapa fica vazio para que uma 2.a chamada nao re-destrua nada.
    expect(players.size).toBe(0);
  });

  it('e idempotente: chamar 2x nao rebenta nem re-fecha a DB', () => {
    const p1 = fakePlayer();
    const players = new Map<string, GuildVoicePlayer>([['g1', p1]]);
    const db = fakeDb();

    shutdown({ players, db });
    expect(() => shutdown({ players, db })).not.toThrow();

    // destroy do player so e chamado na 1.a vez (mapa ja foi esvaziado).
    expect(p1.destroy).toHaveBeenCalledTimes(1);
    // close() so na 1.a vez — guardado por db.open.
    expect(db.close).toHaveBeenCalledTimes(1);
  });

  it('sem players: fecha a DB na mesma', () => {
    const players = new Map<string, GuildVoicePlayer>();
    const db = fakeDb();

    shutdown({ players, db });

    expect(db.close).toHaveBeenCalledTimes(1);
  });

  it('continua a fechar a DB mesmo que um player.destroy() lance', () => {
    const bad = {
      destroy: vi.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as GuildVoicePlayer;
    const good = fakePlayer();
    const players = new Map<string, GuildVoicePlayer>([
      ['g1', bad],
      ['g2', good],
    ]);
    const db = fakeDb();

    expect(() => shutdown({ players, db })).not.toThrow();
    expect(good.destroy).toHaveBeenCalledTimes(1);
    expect(db.close).toHaveBeenCalledTimes(1);
  });
});

describe('installSignalHandlers — idempotencia', () => {
  // O handler chama process.exit(0); espiamo-lo para NAO matar o test runner.
  // Limpamos os listeners que registamos e restauramos o spy depois de cada teste,
  // senao os listeners empilham-se e disparos futuros re-correm closures obsoletas
  // (o que distorceria os contadores toHaveBeenCalledTimes).
  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    vi.restoreAllMocks();
  });

  it('dois SIGINT: shutdown corre 2x mas db.close() no MAXIMO 1x e nao lanca', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const p1 = fakePlayer();
    const players = new Map<string, GuildVoicePlayer>([['g1', p1]]);
    const db = fakeDb();

    installSignalHandlers({ players, db });

    // Nao usamos process.emit('SIGINT') — isso dispararia TODOS os listeners de
    // SIGINT (inclusive os do proprio vitest, que abortariam a run). Em vez disso
    // pegamos no listener que ACABAMOS de registar e chamamo-lo diretamente 2x.
    const handler = process.listeners('SIGINT').at(-1) as () => void;
    expect(typeof handler).toBe('function');

    expect(() => {
      handler(); // 1.º sinal: destroi o player, fecha a DB (db.open -> false)
      handler(); // 2.º sinal: mapa vazio + db.open===false -> nada a fechar
    }).not.toThrow();

    // player.destroy so na 1.a vez (o mapa foi esvaziado por shutdown()).
    expect(p1.destroy).toHaveBeenCalledTimes(1);
    // db.close() no MAXIMO 1x: a 2.a chamada ve db.open===false e nao re-fecha.
    expect(db.close).toHaveBeenCalledTimes(1);
    // process.exit foi invocado (uma vez por sinal) mas nao saiu (mockado).
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('dois SIGTERM: mesmo contrato idempotente (db.close <=1x, sem throw)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    const p1 = fakePlayer();
    const players = new Map<string, GuildVoicePlayer>([['g1', p1]]);
    const db = fakeDb();

    installSignalHandlers({ players, db });

    const handler = process.listeners('SIGTERM').at(-1) as () => void;
    expect(() => {
      handler();
      handler();
    }).not.toThrow();

    expect(p1.destroy).toHaveBeenCalledTimes(1);
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('runs the planned-restart hook before the live calls are destroyed', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const players = new Map<string, GuildVoicePlayer>([['g1', fakePlayer()]]);
    const beforeShutdown = vi.fn(() => expect(players.size).toBe(1));

    installSignalHandlers({ players, db: fakeDb() }, beforeShutdown);
    const handler = process.listeners('SIGTERM').at(-1) as () => void;
    handler();

    expect(beforeShutdown).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
