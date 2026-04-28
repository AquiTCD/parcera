import type { ParceraAPI } from './bridge';
import { api as electronApi } from './electron-bridge';
import { api as tauriApi } from './tauri-bridge';

export const api: ParceraAPI = (window as any).__TAURI_INTERNALS__ ? tauriApi : electronApi;
