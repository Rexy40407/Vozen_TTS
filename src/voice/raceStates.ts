// src/voice/raceStates.ts
//
// "Tidy" Promise.race: the native Promise.race resolves with the FIRST promise to settle,
// but the LOSERS stay alive — when a loser rejects later (e.g. the losing entersState's
// timeout firing), no one has a handler on it and Node emits unhandledRejection. In Vozen
// that would end up at the error webhook (src/bot/client.ts) as a false alarm on EVERY
// failed soft recovery. This helper attaches a no-op catch to each competitor (marks the
// rejection as handled) and returns the normal race — identical semantics: resolves/rejects
// with the first to settle.

export function raceStates<T>(promises: readonly Promise<T>[]): Promise<T> {
  for (const p of promises) {
    // no-op: only marks the promise as "handled"; does not change the race result
    p.catch(() => {});
  }
  return Promise.race(promises);
}
