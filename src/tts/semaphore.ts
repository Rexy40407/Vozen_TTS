// src/tts/semaphore.ts
//
// Semaforo assincrono simples e JUSTO (FIFO), para limitar a concorrencia de uma
// operacao cara (ex. spawns do piper.exe) ATRAVES de todos os pedidos. PURO: sem
// I/O, sem timers. Usa uma fila de "waiters" resolvida por ordem de chegada.
//
// Design importante: `tryAcquire()` e SINCRONO quando ha permit livre — devolve o
// release imediatamente sem passar por um microtask. Isto permite ao chamador
// (PiperEngine) fazer o spawn de forma sincrona no caso comum (sem contencao),
// preservando o comportamento observavel de hoje (os testes que emitem eventos do
// child logo a seguir a synth() continuam a funcionar). So sob CONTENCAO e que se
// espera (`acquire()` devolve uma Promise que resolve quando um permit vagar).

export class Semaphore {
  private permits: number;
  private readonly waiters: Array<() => void> = [];

  /** `size` = nº maximo de permits em simultaneo. Forcado a >= 1 (0 => deadlock). */
  constructor(size: number) {
    this.permits = Math.max(1, Math.floor(size));
  }

  /**
   * Tenta adquirir um permit SEM esperar. Devolve a funcao de release se havia
   * permit livre, ou null se estao todos ocupados. Sincrono.
   */
  tryAcquire(): (() => void) | null {
    if (this.permits > 0) {
      this.permits--;
      return this.makeRelease();
    }
    return null;
  }

  /**
   * Adquire um permit, esperando (FIFO) se necessario. Resolve com a funcao de
   * release (chamar UMA vez para devolver o permit). Se ha permit livre, resolve
   * "de imediato" (mas na mesma via microtask, por ser async — use `tryAcquire`
   * quando precisar de aquisicao verdadeiramente sincrona).
   */
  async acquire(): Promise<() => void> {
    const immediate = this.tryAcquire();
    if (immediate) return immediate;
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    // Fomos acordados por um release que nos PASSOU o permit (sem o devolver ao
    // contador) — por isso nao decrementamos aqui; so criamos o nosso release.
    return this.makeRelease();
  }

  /** Conveniencia: adquire, corre `fn`, e liberta SEMPRE (mesmo em erro). */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /** nº de permits livres neste instante (para testes/observabilidade). */
  get available(): number {
    return this.permits;
  }

  /** nº de chamadas em espera na fila (para testes/observabilidade). */
  get waiting(): number {
    return this.waiters.length;
  }

  /**
   * Cria uma funcao de release de uso UNICO (idempotente: chamadas extra nao
   * over-grantam). Ao libertar: se ha um waiter, PASSA-lhe o permit diretamente
   * (FIFO, sem tocar no contador); senao, devolve o permit ao contador.
   */
  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next) next();
      else this.permits++;
    };
  }
}
