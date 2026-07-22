import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { PiperEngine } from '../src/tts/piper';
import { Semaphore } from '../src/tts/semaphore';
import { AudioCache } from '../src/tts/cache';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
const spawnMock = vi.mocked(spawn);

const flush = () => new Promise<void>((r) => setImmediate(r));

type FakeChild = EventEmitter & {
  stdin: EventEmitter & { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
};

function makeFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  const stdin = new EventEmitter() as FakeChild['stdin'];
  stdin.write = vi.fn();
  stdin.end = vi.fn();
  child.stdin = stdin;
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('PiperEngine — cap global de concorrencia de spawns', () => {
  let dir: string;
  let modelsDir: string;
  let cache: AudioCache;
  const model = 'pt_PT-test';

  beforeEach(() => {
    spawnMock.mockReset();
    dir = mkdtempSync(join(tmpdir(), 'pipercache-'));
    modelsDir = mkdtempSync(join(tmpdir(), 'pipermodels-'));
    writeFileSync(join(modelsDir, `${model}.onnx`), 'dummy');
    cache = new AudioCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(modelsDir, { recursive: true, force: true });
  });

  it('com cap=2 e 5 sinteses concorrentes (todas cache MISS) nunca ha >2 spawns vivos', async () => {
    const children: FakeChild[] = [];
    spawnMock.mockImplementation(() => {
      const c = makeFakeChild();
      children.push(c);
      return c as never;
    });

    const sem = new Semaphore(2);
    const engine = new PiperEngine('piper', modelsDir, cache, undefined, sem);

    // Texto distinto por pedido => chaves de cache distintas => todos MISS.
    const proms = [0, 1, 2, 3, 4].map((i) =>
      // Vao rejeitar com "nao gerou WAV" (spawn mockado nao escreve o ficheiro),
      // mas o que importa e a CONCORRENCIA de spawns, nao o resultado.
      engine.synth({ text: `frase ${i}`, model, speed: 1 }).catch(() => 'err'),
    );

    // Os 2 primeiros adquirem o permit de forma SINCRONA (tryAcquire) -> spawnam ja.
    expect(children.length).toBe(2);

    // Fecha os 2 primeiros processos -> liberta 2 permits -> entram os 2 seguintes.
    children[0].emit('close', 0);
    children[1].emit('close', 0);
    await flush();
    expect(children.length).toBe(4);

    // Fecha mais 2 -> entra o ultimo.
    children[2].emit('close', 0);
    children[3].emit('close', 0);
    await flush();
    expect(children.length).toBe(5);

    // Fecha o ultimo e deixa tudo assentar.
    children[4].emit('close', 0);
    await Promise.all(proms);

    // Invariante central: em nenhum momento houve mais de `cap` spawns por fechar.
    // (Provado pelos degraus acima: 2 -> +2 apos 2 closes -> +1 apos +2 closes.)
    expect(children.length).toBe(5);
  });

  it('um cache HIT nao consome permit (nao fica preso quando o cap esta esgotado)', async () => {
    // Pre-popula a cache para uma request especifica.
    const hitReq = { text: 'cached', model, speed: 1 };
    const fakeWav = join(dir, 'seed.wav');
    writeFileSync(fakeWav, 'RIFFdummy');
    // Usa a API real da cache para semear a entrada.
    const { cacheKey } = await import('../src/tts/cache.js');
    cache.put(cacheKey(hitReq), fakeWav);

    const sem = new Semaphore(1);
    // Esgota o unico permit (simula um spawn a decorrer).
    const holdRelease = sem.tryAcquire()!;

    const engine = new PiperEngine('piper', modelsDir, cache, undefined, sem);
    // Mesmo com o permit esgotado, um cache HIT resolve de imediato (nao espera).
    await expect(engine.synth(hitReq)).resolves.toContain('.wav');

    holdRelease();
  });
});
