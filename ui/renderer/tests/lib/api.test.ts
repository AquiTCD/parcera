import { describe, it, expect } from 'vitest';

describe('api — Tauri bridge', () => {
  it('exports required ParceraAPI methods', async () => {
    const { api } = await import('../../lib/api');
    expect(typeof api.getSettings).toBe('function');
    expect(typeof api.saveSettings).toBe('function');
    expect(typeof api.updateSetting).toBe('function');
    expect(typeof api.onSettingsChanged).toBe('function');
  });
});
