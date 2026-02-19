import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './style.css';

console.log('[Parcera] Renderer process starting...');

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
