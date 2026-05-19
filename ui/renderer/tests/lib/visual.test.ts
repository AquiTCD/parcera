import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api before importing visual
vi.mock('@/lib/api', () => ({
  api: {
    resolveLocalPath: vi.fn((p: string) => p),
    platform: 'tauri',
  },
}));

// Mock audio module — visual.ts calls getRMS/getEnvelope/getVowel/getExternalLipsync every frame
vi.mock('@/lib/audio', () => ({
  getRMS: vi.fn(() => 0),
  getEnvelope: vi.fn(() => 0),
  getVowel: vi.fn(() => null),
  getExternalLipsync: vi.fn(() => null),
  setExternalLipsync: vi.fn(),
  clearExternalLipsync: vi.fn(),
  TALK_THRESHOLD: 0.06,
  getContext: vi.fn(() => null),
}));

describe('visual.ts — resolveLocalPath delegation', () => {
  let img: HTMLImageElement;
  let debug: HTMLDivElement;

  beforeEach(async () => {
    vi.resetModules();
    // Stub requestAnimationFrame to be a no-op so the loop doesn't recurse
    vi.stubGlobal('requestAnimationFrame', (_cb: FrameRequestCallback) => 0);

    img = document.createElement('img');
    debug = document.createElement('div');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls api.resolveLocalPath with a custom assets_dir', async () => {
    const { api } = await import('@/lib/api');
    const { state } = await import('@/lib/state');
    const { initVisual } = await import('@/lib/visual');

    state.avatarType = 'user';
    state.settings = {
      avatars: { user: { assets_dir: '/custom/assets' } },
    } as any;

    initVisual(img, debug);

    expect(api.resolveLocalPath).toHaveBeenCalledWith('/custom/assets');
  });

  it('calls api.resolveLocalPath with leading-slash assets_dir', async () => {
    const { api } = await import('@/lib/api');
    const { state } = await import('@/lib/state');
    const { initVisual } = await import('@/lib/visual');

    state.avatarType = 'ai';
    state.settings = {
      avatars: { ai: { assets_dir: '/assets/ai' } },
    } as any;

    initVisual(img, debug);

    expect(api.resolveLocalPath).toHaveBeenCalledWith('/assets/ai');
  });

  it('falls back to assets/{avatarType} when assets_dir is not set', async () => {
    const { api } = await import('@/lib/api');
    const { state } = await import('@/lib/state');
    const { initVisual } = await import('@/lib/visual');

    state.avatarType = 'user';
    state.settings = { avatars: {} } as any;

    initVisual(img, debug);

    expect(api.resolveLocalPath).toHaveBeenCalledWith('assets/user');
  });
});
