import { describe, it, expect } from 'vitest';
import { Semaphore } from '../src/tts/semaphore';

// Flush de macrotasks/microtasks pendentes (as resolucoes de waiters correm em
// microtask; setImmediate garante que tudo o que ficou agendado ja correu).
const flush = () => new Promise<void>((r) => setImmediate(r));

describe('Semaphore', () => {
  it('tryAcquire e SINCRONO quando ha permit; null quando esgotado', () => {
    const sem = new Semaphore(2);
    const r1 = sem.tryAcquire();
    const r2 = sem.tryAcquire();
    expect(r1).toBeTypeOf('function');
    expect(r2).toBeTypeOf('function');
    expect(sem.tryAcquire()).toBeNull(); // esgotado
    r1!();
    expect(sem.tryAcquire()).toBeTypeOf('function'); // libertou 1
    r2!();
  });

  it('nunca ultrapassa o cap e admite waiters em FIFO', async () => {
    const sem = new Semaphore(2);
    let running = 0;
    let peak = 0;
    const admitted: number[] = [];
    const gates: Array<() => void> = [];

    const tasks = [0, 1, 2, 3, 4].map((i) =>
      sem.run(async () => {
        running++;
        peak = Math.max(peak, running);
        admitted.push(i);
        await new Promise<void>((res) => {
          gates[i] = res;
        });
        running--;
      }),
    );

    await flush();
    // So os 2 primeiros arrancaram (cap=2), por ordem.
    expect(running).toBe(2);
    expect(peak).toBe(2);
    expect(admitted).toEqual([0, 1]);

    gates[0]();
    await flush();
    expect(admitted).toEqual([0, 1, 2]); // FIFO: admite o 2

    gates[1]();
    gates[2]();
    await flush();
    expect(admitted).toEqual([0, 1, 2, 3, 4]); // depois 3 e 4

    gates[3]();
    gates[4]();
    await Promise.all(tasks);
    expect(peak).toBe(2); // nunca passou de 2 em simultaneo
  });

  it('release e idempotente (chamadas extra nao criam permits a mais)', async () => {
    const sem = new Semaphore(1);
    const rel = sem.tryAcquire()!;
    rel();
    rel(); // no-op
    rel(); // no-op
    // So deve haver 1 permit livre, nao 3.
    expect(sem.available).toBe(1);
    expect(sem.tryAcquire()).toBeTypeOf('function');
    expect(sem.tryAcquire()).toBeNull();
  });

  it('size <= 0 e forcado a 1 (evita deadlock)', () => {
    const sem = new Semaphore(0);
    expect(sem.tryAcquire()).toBeTypeOf('function');
    expect(sem.tryAcquire()).toBeNull();
  });

  it('run liberta o permit mesmo quando fn rejeita', async () => {
    const sem = new Semaphore(1);
    await expect(
      sem.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // Permit devolvido apesar do erro.
    expect(sem.available).toBe(1);
  });
});
