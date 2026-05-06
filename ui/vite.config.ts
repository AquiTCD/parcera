import { defineConfig } from 'vite';
import path from 'node:path';
import { copyFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Keep ui/public/obs.html in sync with the canonical src/static/obs.html.
// Both files must be identical: Python serves src/static/, Tauri/Vite serves public/.
const syncObsHtml = {
  name: 'sync-obs-html',
  buildStart() {
    copyFileSync(
      path.join(__dirname, '../src/static/obs.html'),
      path.join(__dirname, 'public/obs.html'),
    );
  },
};

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    syncObsHtml,
  ],
  resolve: {
    alias: {
      '@': path.join(__dirname, 'renderer'),
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
