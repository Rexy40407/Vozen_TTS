interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

// Acima deste numero de buckets, allow() faz uma poda preguicosa (sweep) de
// buckets "cheios+inativos". Muito acima do numero de utilizadores tipico por
// guild, por isso na pratica so dispara em uptime longo com muitos users.
const MAX_BUCKETS = 5000;
// Um bucket so e candidato a poda se o seu ultimo refill for mais antigo que
// isto (ou seja, o user nao fala ha varias janelas). Puramente um knob de
// churn-avoidance — NAO e o que garante a seguranca da poda (ver sweep()).
const DEFAULT_MAX_IDLE_MS = 5 * 60_000;

export class RateLimiter {
  private readonly perMin: number;
  private readonly refillIntervalMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(perMin: number) {
    this.perMin = perMin;
    // tempo (ms) para recarregar um unico token
    this.refillIntervalMs = perMin > 0 ? 60_000 / perMin : Infinity;
  }

  /** Numero de buckets vivos — read-only, so para testes/observabilidade. */
  get bucketCount(): number {
    return this.buckets.size;
  }

  /**
   * Tokens efetivos de um bucket em nowMs, recomputando o refill SEM mutar o
   * estado. Necessario porque `bucket.tokens` armazenado esta sempre <= perMin-1
   * (allow() consome 1 apos refill); ler o valor cru nunca daria "cheio".
   */
  private effectiveTokens(bucket: Bucket, nowMs: number): number {
    const elapsed = nowMs - bucket.lastRefillMs;
    if (elapsed <= 0) return bucket.tokens;
    const refilled = elapsed / this.refillIntervalMs;
    return Math.min(this.perMin, bucket.tokens + refilled);
  }

  /**
   * Poda buckets "cheios+inativos" e devolve quantos removeu.
   *
   * SEGURANCA (semantica intocada): a garantia assenta no teste de "cheio" —
   * um bucket cujos tokens efetivos em nowMs ja atingiram perMin e
   * INDISTINGUIVEL de nao existir: se o user voltar a falar, allow() recria-o
   * cheio (tokens=perMin) — exatamente o mesmo comportamento. O gate maxIdleMs
   * e apenas para evitar churn (nao remover buckets tocados ha pouco); nao e o
   * que torna a operacao segura. Nao muta buckets sobreviventes.
   */
  sweep(nowMs: number, maxIdleMs: number = DEFAULT_MAX_IDLE_MS): number {
    let removed = 0;
    for (const [userId, bucket] of this.buckets) {
      const idle = nowMs - bucket.lastRefillMs;
      if (idle < maxIdleMs) continue; // tocado ha pouco — nao e candidato
      if (this.effectiveTokens(bucket, nowMs) >= this.perMin) {
        this.buckets.delete(userId);
        removed++;
      }
    }
    return removed;
  }

  allow(userId: string, nowMs: number): boolean {
    if (this.perMin <= 0) {
      return false;
    }

    // Poda preguicosa: so quando o mapa cresce demais. Corre antes de criar o
    // bucket deste user para nao contar o proprio. Remove apenas buckets
    // cheios+inativos, logo a semantica observavel nao muda.
    if (this.buckets.size > MAX_BUCKETS) {
      this.sweep(nowMs, DEFAULT_MAX_IDLE_MS);
    }

    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = { tokens: this.perMin, lastRefillMs: nowMs };
      this.buckets.set(userId, bucket);
    }

    // recarrega tokens proporcionalmente ao tempo decorrido
    const elapsed = nowMs - bucket.lastRefillMs;
    if (elapsed > 0) {
      const refilled = elapsed / this.refillIntervalMs;
      if (refilled > 0) {
        bucket.tokens = Math.min(this.perMin, bucket.tokens + refilled);
        bucket.lastRefillMs = nowMs;
      }
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }
}
