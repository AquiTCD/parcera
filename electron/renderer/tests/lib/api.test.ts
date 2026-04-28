import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('api — runtime bridge selection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../../lib/electron-bridge', () => ({ api: { platform: 'electron-mock' } }));
    vi.doMock('../../lib/tauri-bridge', () => ({ api: { platform: 'tauri-mock' } }));
  });

  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
    vi.resetModules();
  });

  it('exports tauri bridge when window.__TAURI_INTERNALS__ is present', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    const { api } = await import('../../lib/api');
    expect(api.platform).toBe('tauri-mock');
  });

  it('exports electron bridge when window.__TAURI_INTERNALS__ is absent', async () => {
    const { api } = await import('../../lib/api');
    expect(api.platform).toBe('electron-mock');
  });
});
