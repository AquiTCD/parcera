import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './globals.css';
import './style.css';

console.log('[Parcera] Renderer process starting...');

// For Tauri avatar windows (?type=user|ai), force transparent backgrounds.
// globals.css @layer base overrides can win over !important in unlayered CSS
// (CSS Cascade L5 reverses !important order for layers), so use inline styles.
const _tauriInternals = (window as any).__TAURI_INTERNALS__;
const _viewType = new URLSearchParams(window.location.search).get('type');
const _isAvatarWindow = _tauriInternals && _viewType !== 'settings' && _viewType !== 'training';
if (_isAvatarWindow) {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
