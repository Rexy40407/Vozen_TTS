// src/logging/logger.ts
//
// Central logger with levels and timestamps.
// Reads LOG_LEVEL from process.env directly (without depending on AppConfig) to
// avoid a circular dependency.  Levels: debug < info < warn < error.
// Default: info.  Invalid value → info.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Formats a log line — pure, side-effect-free, testable. */
export function formatLine(now: Date, level: LogLevel, message: string): string {
  return `${now.toISOString()} [${level.toUpperCase()}] ${message}`;
}

/** Resolves the minimum level from the env (dynamically per call). */
function resolveMinLevel(): number {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase() as LogLevel | undefined;
  return LEVEL_RANK[raw as LogLevel] ?? LEVEL_RANK.info;
}

/** Returns true if a message at this level should be emitted. */
function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= resolveMinLevel();
}

function emit(level: LogLevel, message: string, ...rest: unknown[]): void {
  if (!shouldLog(level)) return;
  const line = formatLine(new Date(), level, message);
  if (level === 'error' || level === 'warn') {
    console.error(line, ...rest);
  } else {
    console.log(line, ...rest);
  }
}

export const log = {
  debug(message: string, ...rest: unknown[]): void {
    emit('debug', message, ...rest);
  },
  info(message: string, ...rest: unknown[]): void {
    emit('info', message, ...rest);
  },
  warn(message: string, ...rest: unknown[]): void {
    emit('warn', message, ...rest);
  },
  error(message: string, ...rest: unknown[]): void {
    emit('error', message, ...rest);
  },
};
