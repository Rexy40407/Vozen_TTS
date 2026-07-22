import type { BotDeps } from './deps';
import { log } from '../logging/logger';
import { shutdownPiperPool } from '../tts/piper';

/**
 * Encerramento limpo, testavel e idempotente.
 *  - destroi todos os players (sai dos canais de voz);
 *  - limpa o mapa de players (uma 2.a chamada nao encontra nada a destruir);
 *  - fecha a DB (guardado por `db.open` para nao fechar duas vezes).
 *
 * NAO chama process.exit — isso fica no wrapper do sinal (installSignalHandlers),
 * para que esta funcao seja testavel sem matar o test runner.
 */
export function shutdown(deps: Pick<BotDeps, 'players' | 'db'>): void {
  log.info('[shutdown] stopping; destroying players and closing the database...');

  for (const player of deps.players.values()) {
    try {
      player.destroy(); // ja e idempotente (if (this.destroyed) return)
    } catch (err) {
      log.error('[shutdown] failed to destroy player', err);
    }
  }
  deps.players.clear();

  // Fecha os processos piper PERSISTENTES (spec T2.1). No-op se o pool nunca foi
  // criado (persistente OFF ou nenhuma sintese ainda) — libertar RAM no encerramento.
  try {
    shutdownPiperPool();
  } catch (err) {
    log.error('[shutdown] failed to close the Piper pool', err);
  }

  try {
    // better-sqlite3 expoe `open`; fica false depois de close(). Guarda contra
    // dupla chamada (fechar uma DB ja fechada lanca).
    if (deps.db.open) {
      deps.db.close();
    }
  } catch (err) {
    log.error('[shutdown] failed to close the database', err);
  }

  log.info('[shutdown] complete.');
}

/**
 * Liga SIGINT/SIGTERM a `shutdown(deps)` e termina o processo limpo.
 * O closure captura `deps` por referencia, por isso o mapa de players e lido
 * no momento do sinal (e nao no registo, quando ainda esta vazio).
 */
export function installSignalHandlers(
  deps: Pick<BotDeps, 'players' | 'db'>,
  beforeShutdown?: () => void,
): void {
  let prepared = false;
  const handler = (signal: string): void => {
    log.info(`[shutdown] received ${signal}.`);
    if (!prepared) {
      prepared = true;
      try {
        beforeShutdown?.();
      } catch (err) {
        log.warn('[shutdown] pre-shutdown hook failed (ignored)', err);
      }
    }
    shutdown(deps);
    process.exit(0);
  };
  process.on('SIGINT', () => handler('SIGINT'));
  process.on('SIGTERM', () => handler('SIGTERM'));
}
