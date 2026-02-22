import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process entry file of the Electron App.
        entry: 'main/index.ts',
      },
      {
        entry: 'main/preload.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
          // instead of restarting the entire Electron App.
          options.reload();
        },
        vite: {
          build: {
            sourcemap: 'inline',
            minify: false,
            outDir: 'dist-electron', // Ensure it outputs to the correct directory
            rollupOptions: {
              external: ['electron'], // Usually handled by plugin, but good to be explicit
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.join(__dirname, 'renderer'),
    },
  },
});
