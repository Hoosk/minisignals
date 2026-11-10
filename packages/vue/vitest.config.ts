import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@hoosk/minisignals': new URL('../core/src/index.ts', import.meta.url).pathname,
    },
  },
});
