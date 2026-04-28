import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tauri-specific Vite config: no vite-plugin-electron or vite-plugin-electron-renderer.
// The Electron config (vite.config.ts) compiles the main process and uses Electron-specific
// polyfills which conflict with Tauri's webview environment.
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.join(__dirname, 'renderer'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
