import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Helios',
    description:
      'A browser extension for language learning with subtitle reading, popup dictionary, vocab tracking, and Anki integration',
    permissions: [
      'storage',
      'alarms',
      'offscreen',
      'activeTab',
      'tabCapture',
      'tabs',
      'scripting',
    ],
    host_permissions: [
      'https://*/*',
      'http://*/*',
      'http://127.0.0.1:8765/*',
      'http://localhost:8765/*',
    ],
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'Helios Language Learning Extension',
    },
    content_scripts: [
      // CSS-only entry: styles for the popup dictionary and video UI, injected
      // alongside the main content script (which is generated from entrypoints).
      {
        matches: ['<all_urls>'],
        css: [
          'ui/popup/popup.css',
          'ui/video/video-styles.css',
          'ui/video/subtitle-selector.css',
        ],
        run_at: 'document_end',
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          'ui/*',
          'freq-dict/*',
          'OnboardingVocab/*',
          'lib/jieba/*',
          'youtube-page.js',
          'netflix-page.js',
        ],
        matches: ['<all_urls>'],
      },
    ],
  },
});
