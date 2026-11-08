import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which NestJS dependency injection needs (esbuild does not).
export default defineConfig({
  // App tests use the in-memory search store; redis-search-store.test.ts talks to Redis directly.
  test: { include: ['test/**/*.test.ts'], env: { REDIS_URL: '' } },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
