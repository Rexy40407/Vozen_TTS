import { describe, it, expect } from 'vitest';
import { resolveShardCount } from '../src/sharding';

// P11.4 — resolveShardCount: funcao PURA que mapeia a env BOT_SHARDS para a decisao
// de sharding. null => SEM sharding (single-process, default). 'auto' => deixar
// o ShardingManager pedir ao Discord a contagem recomendada. N (inteiro >= 2) =>
// numero fixo de shards. A regra de ouro: TUDO o que nao seja claramente um
// pedido de sharding (ausente/vazio/'1'/'0'/invalido) cai em null — o caminho
// single-process e o default seguro e nunca deve ser ativado por engano.
describe('resolveShardCount — decisao de sharding a partir da env BOT_SHARDS', () => {
  it('undefined => null (ausente => single-process)', () => {
    expect(resolveShardCount(undefined)).toBeNull();
  });

  it('"" => null (vazio => single-process)', () => {
    expect(resolveShardCount('')).toBeNull();
  });

  it('"   " => null (so espacos => single-process)', () => {
    expect(resolveShardCount('   ')).toBeNull();
  });

  it('"1" => null (um shard nao e sharding)', () => {
    expect(resolveShardCount('1')).toBeNull();
  });

  it('"0" => null (zero nao faz sentido => single-process)', () => {
    expect(resolveShardCount('0')).toBeNull();
  });

  it('"abc" => null (invalido => single-process)', () => {
    expect(resolveShardCount('abc')).toBeNull();
  });

  it('"2abc" => null (numero parcial NAO conta — Number, nao parseInt)', () => {
    expect(resolveShardCount('2abc')).toBeNull();
  });

  it('"-3" => null (negativo => single-process)', () => {
    expect(resolveShardCount('-3')).toBeNull();
  });

  it('"1.5" => null (nao-inteiro => single-process)', () => {
    expect(resolveShardCount('1.5')).toBeNull();
  });

  it('"auto" => "auto" (deixa o manager pedir a contagem ao Discord)', () => {
    expect(resolveShardCount('auto')).toBe('auto');
  });

  it('"  auto  " => "auto" (faz trim, espelhando engineEnv)', () => {
    expect(resolveShardCount('  auto  ')).toBe('auto');
  });

  it('"2" => 2 (inteiro >= 2 => contagem fixa)', () => {
    expect(resolveShardCount('2')).toBe(2);
  });

  it('"8" => 8', () => {
    expect(resolveShardCount('8')).toBe(8);
  });

  it('" 8 " => 8 (faz trim do numero)', () => {
    expect(resolveShardCount(' 8 ')).toBe(8);
  });
});
