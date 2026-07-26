import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['site-tests/**/*.test.mjs'],
    environment: 'node',
    coverage: { enabled: false },
  },
});
