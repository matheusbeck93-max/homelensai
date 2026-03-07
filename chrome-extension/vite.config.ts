import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite config for the popup entry point only.
 * Content script and background are built via esbuild in build.mjs.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
