import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// P11.4 — teste (c) do launcher: confirma a ESCOLHA manager-vs-direto sem ligar
// ao Discord. Estrategia de isolamento:
//   - vi.mock('discord.js') parcial: substitui SÓ o ShardingManager por um spy,
//     para podermos afirmar se (e como) foi construido, sem rede.
//   - vi.mock do logger: silencia o output e evita ruido nos testes.
// A env BOT_SHARDS controla o ramo; resolveShardCount (testado a parte) faz o mapa.
// (BOT_SHARDS, nao `SHARDS`: esta ultima e reservada e lida pelo Client do
// discord.js — usa-la aqui partiria o single-process default.)
//
// NOTA sobre o ramo single-process (BOT_SHARDS ausente): NAO e testado aqui de
// proposito. Esse ramo faz `require('./index')`, resolvido pelo resolver CJS
// nativo do Node, que so encontra index.js em runtime (dist/) — em vitest aponta
// para o .ts de origem e o vi.mock nao intercepta um require CJS dinamico. A
// decisao null => single-process esta coberta exaustivamente por
// resolveShardCount(undefined) === null (ver tests/sharding.test.ts); o spawn
// fica como verificacao ao vivo. Aqui afirmamos o que importa de verdade: que
// um ShardingManager NUNCA e construido no caminho default, e e-o em auto/N.

const shardingManagerCtor = vi.fn();
const onSpy = vi.fn();
const spawnSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('discord.js', () => ({
  // Construtor falso: regista os argumentos e devolve um objeto com on/spawn.
  ShardingManager: class {
    constructor(...args: unknown[]) {
      shardingManagerCtor(...args);
    }
    on = onSpy;
    spawn = spawnSpy;
  },
}));

vi.mock('../src/logging/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const REQUIRED = { DISCORD_TOKEN: 'tok-xyz', CLIENT_ID: 'client-xyz' };

function setEnv(env: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('runShardLauncher — escolha manager vs single-process', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    shardingManagerCtor.mockClear();
    onSpy.mockClear();
    spawnSpy.mockClear();
    setEnv({ ...REQUIRED, BOT_SHARDS: undefined });
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
  });

  it('BOT_SHARDS="2": constroi ShardingManager com totalShards=2 e faz spawn', async () => {
    setEnv({ ...REQUIRED, BOT_SHARDS: '2' });
    const { runShardLauncher } = await import('../src/shard.js');
    runShardLauncher();
    expect(shardingManagerCtor).toHaveBeenCalledTimes(1);
    const [file, opts] = shardingManagerCtor.mock.calls[0] as [
      string,
      { token: string; totalShards: unknown },
    ];
    expect(file).toMatch(/index\.js$/);
    expect(opts.totalShards).toBe(2);
    expect(opts.token).toBe('tok-xyz');
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });

  it('BOT_SHARDS="auto": constroi ShardingManager com totalShards="auto"', async () => {
    setEnv({ ...REQUIRED, BOT_SHARDS: 'auto' });
    const { runShardLauncher } = await import('../src/shard.js');
    runShardLauncher();
    expect(shardingManagerCtor).toHaveBeenCalledTimes(1);
    const [, opts] = shardingManagerCtor.mock.calls[0] as [string, { totalShards: unknown }];
    expect(opts.totalShards).toBe('auto');
  });
});
