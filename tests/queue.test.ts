import { describe, it, expect } from 'vitest';
import { MAX_ACCESSIBILITY_BURST, PlayQueue } from '../src/voice/queue';
import type { SynthRequest } from '../src/tts/engine';

const item = (text: string): { req: SynthRequest } => ({
  req: { text, model: 'm', speed: 1 },
});

describe('PlayQueue', () => {
  it('arranca vazia', () => {
    const q = new PlayQueue(3);
    expect(q.size()).toBe(0);
    expect(q.dequeue()).toBeUndefined();
  });

  it('enqueue/dequeue respeita ordem FIFO', () => {
    const q = new PlayQueue(3);
    expect(q.enqueue(item('a'))).toBe(true);
    expect(q.enqueue(item('b'))).toBe(true);
    expect(q.size()).toBe(2);
    expect(q.dequeue()?.req).toEqual(item('a').req);
    expect(q.dequeue()?.req).toEqual(item('b').req);
    expect(q.dequeue()).toBeUndefined();
    expect(q.size()).toBe(0);
  });

  it('enqueue devolve false quando cheia e nao adiciona', () => {
    const q = new PlayQueue(2);
    expect(q.enqueue(item('a'))).toBe(true);
    expect(q.enqueue(item('b'))).toBe(true);
    expect(q.enqueue(item('c'))).toBe(false);
    expect(q.size()).toBe(2);
    expect(q.dequeue()?.req).toEqual(item('a').req);
  });

  it('enqueueMany is atomic when the full batch does not fit', () => {
    const q = new PlayQueue(2);
    expect(q.enqueue(item('existing'))).toBe(true);
    expect(q.enqueueMany([item('part one'), item('part two')])).toBe(false);
    expect(q.size()).toBe(1);
    expect(q.dequeue()?.req.text).toBe('existing');
  });

  it('enqueueMany preserves chunk order and shared attribution', () => {
    const q = new PlayQueue(3);
    expect(
      q.enqueueMany([item('part one'), item('part two')], {
        authorId: 'author',
        source: 'message',
        now: 100,
      }),
    ).toBe(true);
    expect(q.snapshot(150).map(({ source, ageMs }) => ({ source, ageMs }))).toEqual([
      { source: 'message', ageMs: 50 },
      { source: 'message', ageMs: 50 },
    ]);
    expect(q.dequeue()?.req.text).toBe('part one');
    expect(q.dequeue()?.req.text).toBe('part two');
  });

  it('depois de dequeue ha espaco para enqueue de novo', () => {
    const q = new PlayQueue(1);
    expect(q.enqueue(item('a'))).toBe(true);
    expect(q.enqueue(item('b'))).toBe(false);
    q.dequeue();
    expect(q.enqueue(item('b'))).toBe(true);
    expect(q.size()).toBe(1);
  });

  it('clear esvazia a fila', () => {
    const q = new PlayQueue(3);
    q.enqueue(item('a'));
    q.enqueue(item('b'));
    q.clear();
    expect(q.size()).toBe(0);
    expect(q.dequeue()).toBeUndefined();
  });

  it('cap=0 rejeita sempre o enqueue', () => {
    const q = new PlayQueue(0);
    expect(q.enqueue(item('a'))).toBe(false);
    expect(q.enqueue(item('b'))).toBe(false);
    expect(q.size()).toBe(0);
    // Continua a rejeitar mesmo depois de tentativas repetidas
    expect(q.enqueue(item('c'))).toBe(false);
    expect(q.size()).toBe(0);
  });

  it('cap=1 aceita o 1o, rejeita o 2o e volta a aceitar apos dequeue', () => {
    const q = new PlayQueue(1);
    expect(q.enqueue(item('a'))).toBe(true);
    expect(q.enqueue(item('b'))).toBe(false);
    expect(q.size()).toBe(1);
    // Liberta a unica vaga
    expect(q.dequeue()?.req).toEqual(item('a').req);
    expect(q.size()).toBe(0);
    // Ha espaco de novo
    expect(q.enqueue(item('b'))).toBe(true);
    expect(q.size()).toBe(1);
  });

  it('dequeue numa fila vazia devolve undefined', () => {
    const q = new PlayQueue(3);
    expect(q.dequeue()).toBeUndefined();
    // Continua undefined em chamadas repetidas
    expect(q.dequeue()).toBeUndefined();
    expect(q.size()).toBe(0);
  });

  it('clear a meio esvazia e a fila aceita de novo', () => {
    const q = new PlayQueue(3);
    q.enqueue(item('a'));
    q.enqueue(item('b'));
    expect(q.size()).toBe(2);
    q.clear();
    expect(q.size()).toBe(0);
    // Depois do clear volta a aceitar itens normalmente
    expect(q.enqueue(item('c'))).toBe(true);
    expect(q.size()).toBe(1);
    expect(q.dequeue()?.req).toEqual(item('c').req);
  });

  it('uses two FIFO lanes with a shared cap and accessibility only between items', () => {
    const q = new PlayQueue(3);
    q.enqueue(item('first'), { authorId: 'u1', source: 'message', now: 100 });
    q.enqueue(item('priority'), {
      authorId: 'u2',
      source: 'command',
      lane: 'accessibility',
      now: 101,
    });
    q.enqueue(item('second'), { authorId: 'u3', source: 'message', now: 102 });
    expect(q.enqueue(item('over-cap'))).toBe(false);
    expect(q.dequeue()?.req.text).toBe('priority');
    expect(q.dequeue()?.req.text).toBe('first');
    expect(q.dequeue()?.req.text).toBe('second');
  });

  it('limits sustained accessibility bursts so a waiting standard job is not starved', () => {
    const q = new PlayQueue(10);
    q.enqueue(item('normal'));
    for (let i = 0; i < MAX_ACCESSIBILITY_BURST + 2; i++) {
      q.enqueue(item(`priority-${i}`), { lane: 'accessibility' });
    }
    const first = Array.from({ length: MAX_ACCESSIBILITY_BURST }, () => q.dequeue()?.req.text);
    expect(first).toEqual(
      Array.from({ length: MAX_ACCESSIBILITY_BURST }, (_, i) => `priority-${i}`),
    );
    expect(q.dequeue()?.req.text).toBe('normal');
    expect(q.dequeue()?.req.text).toBe(`priority-${MAX_ACCESSIBILITY_BURST}`);
  });

  it('snapshot is opaque and author removal does not expose another request', () => {
    const q = new PlayQueue(3);
    q.enqueue(item('private spoken text'), { authorId: 'author-a', source: 'message', now: 100 });
    q.enqueue(item('other secret'), { authorId: 'author-b', source: 'command', now: 101 });
    const snapshot = q.snapshot(150);
    expect(snapshot).toHaveLength(2);
    expect(JSON.stringify(snapshot)).not.toContain('private spoken text');
    expect(JSON.stringify(snapshot)).not.toContain('author-a');
    expect(snapshot[0]).toMatchObject({ source: 'message', lane: 'standard', ageMs: 50 });
    expect(q.removeByAuthor('author-a')).toBe(1);
    expect(q.size()).toBe(1);
    expect(q.dequeue()?.req.text).toBe('other secret');
  });
});
