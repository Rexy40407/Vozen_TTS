import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Excluded so the threshold measures LOGIC, not data. src/i18n/locales alone is
      // ~22k of the ~40k statements — pure string maps that are 100% "covered" by merely
      // being imported, which dragged the global average up and let genuinely risky code
      // (the interactive handlers) sit far below the bar while the gate stayed green.
      // Their real guard is tests/i18n.test.ts (key parity, placeholders, non-empty), not
      // line coverage. index.ts/shard.ts are the composition roots (orchestration).
      exclude: ['src/index.ts', 'src/shard.ts', 'src/i18n/locales/**', 'src/content/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
});
