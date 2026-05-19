import type { ParceraAPI } from './bridge';
import { api as tauriApi } from './tauri-bridge';
import { obsApi } from './obs-bridge';

export const isObs = new URLSearchParams(window.location.search).get('obs') === '1';

export const api: ParceraAPI = isObs ? obsApi : tauriApi;
