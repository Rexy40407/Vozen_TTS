// scripts/supervisorPolicy.d.mts — tipos para o import em tests/startProd.test.ts.
export declare const BACKOFF_BASE_MS: number;
export declare const BACKOFF_MAX_MS: number;
export declare const STABLE_RESET_MS: number;
export declare const PREWARM_MAX_TRIES: number;
export declare function backoffDelayMs(attempt: number): number;
export type ExitDecision =
  | { action: 'ignore' }
  | { action: 'stop' }
  | { action: 'restart'; delayMs: number; nextAttempt: number };
export declare function decideOnExit(
  code: number | null,
  stopping: boolean,
  attempt: number,
): ExitDecision;
export declare function prewarmNative(
  tryLoad: () => boolean,
  log: (m: string) => void,
  maxTries?: number,
): boolean;
