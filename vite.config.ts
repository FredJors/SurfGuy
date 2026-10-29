/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build-Ziel: eine einzige, eigenständige index.html (JS, CSS, Modelle, Texturen eingebettet).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  // Modelle/Texturen, die per Import eingebunden werden, landen als Data-URL im Bundle.
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  build: {
    target: 'es2022',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 4096,
    cssCodeSplit: false,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
