import type { ParceraAPI } from './bridge';
import { api as tauriApi } from './tauri-bridge';

export const api: ParceraAPI = tauriApi;
