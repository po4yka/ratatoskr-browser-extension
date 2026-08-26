import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Several specs spawn child processes (build, package); cold starts cost seconds.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
