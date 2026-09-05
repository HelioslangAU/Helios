/**
 * Netflix Early Injection Script
 * Runs at document_start to inject page script BEFORE Netflix loads
 * This is critical for intercepting Netflix's JSON.parse/stringify calls
 */
import { defineContentScript } from '#imports';
import { PATHS } from '@/config/paths';

export default defineContentScript({
  matches: ['*://*.netflix.com/*'],
  runAt: 'document_start',
  allFrames: false,
  main() {
    // Only run on Netflix
    if (!window.location.hostname.includes('netflix.com')) {
      return;
    }

    console.log('[Helios Netflix] Early inject running at document_start');

    // Inject page script immediately
    const script = document.createElement('script');
    script.src = PATHS.url(PATHS.PAGE_SCRIPTS.NETFLIX);
    script.onload = () => {
      console.log('[Helios Netflix] Page script injected early');
      script.remove();
    };
    script.onerror = (error) => {
      console.error('[Helios Netflix] Failed to inject page script:', error);
    };

    // Inject into document as early as possible
    (document.head || document.documentElement).appendChild(script);
  },
});
