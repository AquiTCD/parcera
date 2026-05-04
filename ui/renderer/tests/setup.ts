import '@testing-library/jest-dom';

// Polyfill for Radix UI components that use ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
