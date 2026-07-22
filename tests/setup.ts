// GLOBAL setup for the test suite (vitest `setupFiles`).
//
// Forces the Piper ONE-SHOT path (`PIPER_PERSISTENT=0`) during the tests. In
// production the persistent pool is ON by default (T2.1), but the tests that mock
// `child_process.spawn` (piper.test.ts, piperConcurrency.test.ts) assume the one-shot
// protocol (close/error), not the pool's (stdout lines). The persistent pool is tested
// in ISOLATION in piperPool.test.ts (which injects the spawn directly), so this flag
// does not affect it. Pinning it here prevents any future test from falling into the
// pool by accident.
process.env.PIPER_PERSISTENT = '0';
