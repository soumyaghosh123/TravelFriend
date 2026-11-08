import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which NestJS dependency injection needs (esbuild does not).
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
