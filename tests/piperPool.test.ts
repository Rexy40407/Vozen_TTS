// tests/piperPool.test.ts
//
// TDD do pool de processos piper.exe PERSISTENTES (spec T2.1). Simula o protocolo
// real do piper `--json-input`: cada synth() escreve UMA linha JSON no stdin; o
// piper imprime o output_file terminado no STDOUT, uma linha por utterance, em
// ordem FIFO estrita. Essa linha de stdout E o sinal de conclusao.
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PiperProcess, PiperPool, type ChildLike } from '../src/tts/piperPool';

/**
 * Child fake: stdout e um EventEmitter real (emitimos 'data' com Buffers, como o
 * piper faria). stdin.write/end e kill sao spies. `on` (top-level) e um
 * EventEmitter para podermos emitir 'exit'/'error'. Chega para injetar no
 * PiperProcess e simular o protocolo stdout.
 */
function makeFakeChild(): ChildLike & {
  stdout: EventEmitter;
  emitExit: (code: number | null) => void;
  emitErr: (err: Error) => void;
} {
  const bus = new EventEmitter();
  const stdout = new EventEmitter();
  const stdin = { write: vi.fn(), end: vi.fn() };
  const kill = vi.fn();
  return {
    stdin,
    stdout: stdout as unknown as ChildLike['stdout'] & EventEmitter,
    on(event: string, cb: (...a: unknown[]) => void) {
      bus.on(event, cb);
      return this;
    },
    kill,
    emitExit: (code: number | null) => bus.emit('exit', code),
    emitErr: (err: Error) => bus.emit('error', err),
  } as never;
}

describe('PiperProcess — protocolo stdout FIFO', () => {
  it('duas synth() enfileiradas resolvem em ordem quando o stdout imprime os paths', async () => {
    const child = makeFakeChild();
    const onExit = vi.fn();
    const proc = new PiperProcess(child, onExit);

    const order: string[] = [];
    const p1 = proc.synth('primeiro', 'C:\\out\\a.wav', 10000).then(() => order.push('a'));
    const p2 = proc.synth('segundo', 'C:\\out\\b.wav', 10000).then(() => order.push('b'));

    // stdin.write chamado 2x com linhas JSON validas (text + output_file).
    expect(child.stdin.write).toHaveBeenCalledTimes(2);
    const line1 = (child.stdin.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const line2 = (child.stdin.write as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(line1.endsWith('\n')).toBe(true);
    expect(line2.endsWith('\n')).toBe(true);
    const j1 = JSON.parse(line1);
    const j2 = JSON.parse(line2);
    expect(j1.text).toBe('primeiro');
    expect(j1.output_file).toBe('C:\\out\\a.wav');
    expect(j2.text).toBe('segundo');
    expect(j2.output_file).toBe('C:\\out\\b.wav');

    // piper imprime os paths terminados, em ordem de entrada.
    child.stdout.emit('data', Buffer.from('C:\\out\\a.wav\n'));
    child.stdout.emit('data', Buffer.from('C:\\out\\b.wav\n'));

    await Promise.all([p1, p2]);
    expect(order).toEqual(['a', 'b']);
    expect(onExit).not.toHaveBeenCalled();
    expect(proc.dead).toBe(false);
  });

  it('resolve por ORDEM FIFO mesmo com linhas partidas em varios chunks e \\r\\n', async () => {
    const child = makeFakeChild();
    const proc = new PiperProcess(child, vi.fn());

    const order: string[] = [];
    const p1 = proc.synth('a', 'C:\\a.wav', 10000).then(() => order.push('1'));
    const p2 = proc.synth('b', 'C:\\b.wav', 10000).then(() => order.push('2'));

    // Chunk parcial + resto, e \r\n (Windows) — deve ser trimado.
    child.stdout.emit('data', Buffer.from('C:\\a'));
    child.stdout.emit('data', Buffer.from('.wav\r\nC:\\b.wav\r\n'));

    await Promise.all([p1, p2]);
    expect(order).toEqual(['1', '2']);
  });
});

describe('PiperProcess — crash e timeout', () => {
  it("emitir 'exit' com uma utterance pendente rejeita-a, marca dead e chama onExit uma vez", async () => {
    const child = makeFakeChild();
    const onExit = vi.fn();
    const proc = new PiperProcess(child, onExit);

    const p = proc.synth('x', 'C:\\x.wav', 10000);
    child.emitExit(1);

    await expect(p).rejects.toThrow();
    expect(proc.dead).toBe(true);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(proc);
  });

  it('crash seguido de nada nao dispara onExit duas vezes (guard)', async () => {
    const child = makeFakeChild();
    const onExit = vi.fn();
    const proc = new PiperProcess(child, onExit);

    const p = proc.synth('x', 'C:\\x.wav', 10000);
    child.emitErr(new Error('boom'));
    child.emitExit(1); // segunda morte — nao deve re-disparar

    await expect(p).rejects.toThrow();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('processo dead rejeita novas synth() sem aceitar trabalho', async () => {
    const child = makeFakeChild();
    const proc = new PiperProcess(child, vi.fn());
    const p = proc.synth('x', 'C:\\x.wav', 10000);
    child.emitExit(1);
    await expect(p).rejects.toThrow();

    await expect(proc.synth('y', 'C:\\y.wav', 10000)).rejects.toThrow();
  });

  it('timeout: uma utterance sem linha de stdout rejeita apos timeoutMs, mata o processo e marca dead', async () => {
    vi.useFakeTimers();
    try {
      const child = makeFakeChild();
      const onExit = vi.fn();
      const proc = new PiperProcess(child, onExit);

      const p = proc.synth('x', 'C:\\x.wav', 5000);
      // atacha o handler de rejeicao ANTES de avancar o tempo (evita unhandled).
      const assertion = expect(p).rejects.toThrow(/timeout/i);
      await vi.advanceTimersByTimeAsync(5001);
      await assertion;

      expect(child.kill).toHaveBeenCalled();
      expect(proc.dead).toBe(true);
      expect(onExit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('timeout mata o processo E rejeita as restantes utterances enfileiradas', async () => {
    vi.useFakeTimers();
    try {
      const child = makeFakeChild();
      const proc = new PiperProcess(child, vi.fn());

      const p1 = proc.synth('a', 'C:\\a.wav', 5000);
      const p2 = proc.synth('b', 'C:\\b.wav', 5000);
      const a1 = expect(p1).rejects.toThrow();
      const a2 = expect(p2).rejects.toThrow();

      await vi.advanceTimersByTimeAsync(5001);
      await Promise.all([a1, a2]);
      expect(proc.dead).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PiperPool — reuso, LRU e re-spawn', () => {
  // Cada spawn devolve um child fake distinto que guardamos para poder emitir
  // o stdout e resolver a synth de forma deterministica.
  function makeSpawningPool(opts: { maxWarm: number; idleMs?: number }) {
    const children: ReturnType<typeof makeFakeChild>[] = [];
    const spawn = vi.fn((_args: string[]) => {
      const c = makeFakeChild();
      children.push(c);
      return c as unknown as ChildLike;
    });
    const pool = new PiperPool({
      maxWarm: opts.maxWarm,
      idleMs: opts.idleMs ?? 5 * 60 * 1000,
      spawn,
    });
    return { pool, spawn, children };
  }

  it('tres keys distintas -> spawn 3x; a LRU e morta exatamente 1x ao spawnar a 3.a', async () => {
    const { pool, spawn, children } = makeSpawningPool({ maxWarm: 2 });

    const pA = pool.synth('kA', ['--model', 'A'], 'a', 'C:\\a.wav', 10000);
    children[0].stdout.emit('data', Buffer.from('C:\\a.wav\n'));
    await pA;

    const pB = pool.synth('kB', ['--model', 'B'], 'b', 'C:\\b.wav', 10000);
    children[1].stdout.emit('data', Buffer.from('C:\\b.wav\n'));
    await pB;

    // 3.a key distinta -> excede maxWarm=2 -> evict LRU (kA, o child[0]).
    const pC = pool.synth('kC', ['--model', 'C'], 'c', 'C:\\c.wav', 10000);
    children[2].stdout.emit('data', Buffer.from('C:\\c.wav\n'));
    await pC;

    expect(spawn).toHaveBeenCalledTimes(3);
    // kA foi a menos-recentemente-usada -> child[0] morto exatamente 1x.
    expect(children[0].kill).toHaveBeenCalledTimes(1);
    // kB/kC continuam vivos.
    expect(children[1].kill).not.toHaveBeenCalled();
    expect(children[2].kill).not.toHaveBeenCalled();
  });

  it('mesma key reutiliza o processo vivo — spawn NAO e chamado de novo', async () => {
    const { pool, spawn, children } = makeSpawningPool({ maxWarm: 2 });

    const p1 = pool.synth('kA', ['--model', 'A'], 'a', 'C:\\a.wav', 10000);
    children[0].stdout.emit('data', Buffer.from('C:\\a.wav\n'));
    await p1;

    const p2 = pool.synth('kA', ['--model', 'A'], 'b', 'C:\\b.wav', 10000);
    children[0].stdout.emit('data', Buffer.from('C:\\b.wav\n'));
    await p2;

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(children.length).toBe(1);
  });

  it('key cujo processo morreu re-spawna na proxima synth', async () => {
    const { pool, spawn, children } = makeSpawningPool({ maxWarm: 2 });

    const p1 = pool.synth('kA', ['--model', 'A'], 'a', 'C:\\a.wav', 10000);
    children[0].stdout.emit('data', Buffer.from('C:\\a.wav\n'));
    await p1;

    // O processo morre (crash).
    children[0].emitExit(1);

    const p2 = pool.synth('kA', ['--model', 'A'], 'b', 'C:\\b.wav', 10000);
    children[1].stdout.emit('data', Buffer.from('C:\\b.wav\n'));
    await p2;

    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('reusar kA depois de kB torna kB a LRU: ao spawnar kC, kB e evicto (nao kA)', async () => {
    const { pool, children } = makeSpawningPool({ maxWarm: 2 });

    // kA
    const pA = pool.synth('kA', ['--model', 'A'], 'a', 'C:\\a.wav', 10000);
    children[0].stdout.emit('data', Buffer.from('C:\\a.wav\n'));
    await pA;
    // kB
    const pB = pool.synth('kB', ['--model', 'B'], 'b', 'C:\\b.wav', 10000);
    children[1].stdout.emit('data', Buffer.from('C:\\b.wav\n'));
    await pB;
    // toca em kA de novo -> kA passa a most-recently-used; kB e agora a LRU.
    const pA2 = pool.synth('kA', ['--model', 'A'], 'a2', 'C:\\a2.wav', 10000);
    children[0].stdout.emit('data', Buffer.from('C:\\a2.wav\n'));
    await pA2;
    // kC -> evicta a LRU (kB = child[1]).
    const pC = pool.synth('kC', ['--model', 'C'], 'c', 'C:\\c.wav', 10000);
    children[2].stdout.emit('data', Buffer.from('C:\\c.wav\n'));
    await pC;

    expect(children[1].kill).toHaveBeenCalledTimes(1); // kB evicto
    expect(children[0].kill).not.toHaveBeenCalled(); // kA sobreviveu
  });

  it('shutdown() mata todos os processos e limpa o mapa', async () => {
    const { pool, spawn, children } = makeSpawningPool({ maxWarm: 3 });

    const pA = pool.synth('kA', ['--model', 'A'], 'a', 'C:\\a.wav', 10000);
    children[0].stdout.emit('data', Buffer.from('C:\\a.wav\n'));
    await pA;
    const pB = pool.synth('kB', ['--model', 'B'], 'b', 'C:\\b.wav', 10000);
    children[1].stdout.emit('data', Buffer.from('C:\\b.wav\n'));
    await pB;

    pool.shutdown();
    expect(children[0].kill).toHaveBeenCalled();
    expect(children[1].kill).toHaveBeenCalled();

    // Depois do shutdown, uma nova synth spawna de novo (mapa limpo).
    const pC = pool.synth('kA', ['--model', 'A'], 'c', 'C:\\c.wav', 10000);
    children[2].stdout.emit('data', Buffer.from('C:\\c.wav\n'));
    await pC;
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it('idle: sem trabalho por idleMs, o processo e morto e removido (re-spawna depois)', async () => {
    vi.useFakeTimers();
    try {
      const { pool, spawn, children } = makeSpawningPool({ maxWarm: 2, idleMs: 1000 });

      const pA = pool.synth('kA', ['--model', 'A'], 'a', 'C:\\a.wav', 10000);
      children[0].stdout.emit('data', Buffer.from('C:\\a.wav\n'));
      await pA;

      // Passa o tempo de idle sem trabalho -> processo morto + removido.
      await vi.advanceTimersByTimeAsync(1001);
      expect(children[0].kill).toHaveBeenCalled();

      // Proxima synth re-spawna (mapa nao tem mais kA).
      const pA2 = pool.synth('kA', ['--model', 'A'], 'b', 'C:\\b.wav', 10000);
      children[1].stdout.emit('data', Buffer.from('C:\\b.wav\n'));
      await pA2;
      expect(spawn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
