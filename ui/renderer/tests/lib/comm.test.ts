import { describe, it, expect } from 'vitest';
import { buildWsUrl, buildServerUrl, DEFAULT_PORT } from '../../lib/comm';

describe('comm URL builders', () => {
  describe('DEFAULT_PORT', () => {
    it('is 8676 (matches Python server default)', () => {
      expect(DEFAULT_PORT).toBe(8676);
    });
  });

  describe('buildWsUrl', () => {
    it('builds WebSocket URL with given port', () => {
      expect(buildWsUrl(8676)).toBe('ws://127.0.0.1:8676/ws');
    });

    it('uses 127.0.0.1 not localhost', () => {
      expect(buildWsUrl(8676)).toContain('127.0.0.1');
      expect(buildWsUrl(8676)).not.toContain('localhost');
    });

    it('uses DEFAULT_PORT when called with DEFAULT_PORT', () => {
      expect(buildWsUrl(DEFAULT_PORT)).toBe(`ws://127.0.0.1:${DEFAULT_PORT}/ws`);
    });
  });

  describe('buildServerUrl', () => {
    it('builds HTTP URL with port and path', () => {
      expect(buildServerUrl(8676, '/health')).toBe('http://127.0.0.1:8676/health');
    });

    it('uses 127.0.0.1 not localhost', () => {
      expect(buildServerUrl(8676, '/health')).toContain('127.0.0.1');
      expect(buildServerUrl(8676, '/health')).not.toContain('localhost');
    });

    it('handles paths without leading slash', () => {
      const url = buildServerUrl(8676, 'health');
      expect(url).toBe('http://127.0.0.1:8676/health');
    });

    it('handles nested paths', () => {
      expect(buildServerUrl(9999, '/twitch/status')).toBe('http://127.0.0.1:9999/twitch/status');
    });
  });
});
