import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // happy-dom gives the DOM-touching modules a document to work against;
    // wxt/testing/fake-browser provides an in-memory chrome.* implementation.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
