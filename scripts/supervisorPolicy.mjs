// scripts/supervisorPolicy.mjs — política PURA do supervisor (start-prod.mjs).
// Extraída para ser testável em vitest sem processos reais. NÃO importa nada
// com efeitos secundários; o start-prod.mjs injeta spawn/log.

export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 60000;
export const STABLE_RESET_MS = 60000;
export const PREWARM_MAX_TRIES = 5;

/** Delay do reinício N (attempt começa em 0): 2s→4s→…→60s (limitado). */
export function backoffDelayMs(attempt) {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
}

/**
 * Decide o que fazer quando o bot termina.
 * Espelha 1:1 o handler original: stopping → ignorar; código 0 → parar de vez;
 * caso contrário → reiniciar com backoff (delay do attempt ATUAL, attempt+1 a seguir).
 */
export function decideOnExit(code, stopping, attempt) {
  if (stopping) return { action: 'ignore' };
  if (code === 0) return { action: 'stop' };
  return { action: 'restart', delayMs: backoffDelayMs(attempt), nextAttempt: attempt + 1 };
}

/**
 * Loop de pré-aquecimento do módulo nativo, com o "carregar uma vez" INJETADO
 * (tryLoad devolve true quando o load teve sucesso). Mensagens idênticas às originais.
 */
export function prewarmNative(tryLoad, log, maxTries = PREWARM_MAX_TRIES) {
  for (let i = 1; i <= maxTries; i++) {
    if (tryLoad()) {
      log(`voz (davey) pronta (tentativa ${i}).`);
      return true;
    }
    log(`davey bloqueado/indisponível (tentativa ${i}/${maxTries}) — a repetir…`);
  }
  log('AVISO: davey não carregou em 5 tentativas. Pode ser bloqueio persistente do');
  log('Smart App Control. Arranco na mesma; se o bot crashar no arranque com');
  log('ERR_DLOPEN_FAILED, vê docs/HOSPEDAR.md (secção Smart App Control).');
  return false;
}
