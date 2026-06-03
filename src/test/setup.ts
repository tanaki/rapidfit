import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ── ResizeObserver ────────────────────────────────────────────────────────────
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ── MediaDevices ──────────────────────────────────────────────────────────────
Object.defineProperty(window.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  configurable: true,
});

// ── MediaStream ───────────────────────────────────────────────────────────────
window.MediaStream = class MediaStream {
  getTracks() { return []; }
} as unknown as typeof MediaStream;

// ── MediaRecorder ─────────────────────────────────────────────────────────────
window.MediaRecorder = class MediaRecorder {
  static isTypeSupported() { return false; }
} as unknown as typeof MediaRecorder;

// ── IndexedDB stub ────────────────────────────────────────────────────────────
Object.defineProperty(window, 'indexedDB', {
  value: {
    open: () => {
      const req = {} as IDBOpenDBRequest;
      setTimeout(() => req.onerror?.(new Event('error')));
      return req;
    },
  } as unknown as IDBFactory,
  configurable: true,
});
