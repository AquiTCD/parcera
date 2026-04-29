import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './globals.css';
import './style.css';

console.log('[Parcera] Renderer process starting...');

// Tauri uses data-tauri-drag-region instead of -webkit-app-region CSS
if ((window as any).__TAURI_INTERNALS__) {
  document.body.setAttribute('data-tauri-drag-region', '');
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
