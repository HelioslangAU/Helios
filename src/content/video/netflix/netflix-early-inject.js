/**
 * Netflix Early Injection Script
 * Runs at document_start to inject page script BEFORE Netflix loads
 * This is critical for intercepting Netflix's JSON.parse/stringify calls
 */

(function() {
    'use strict';

    // Only run on Netflix
    if (!window.location.hostname.includes('netflix.com')) {
        return;
    }

    console.log('[Helios Netflix] Early inject running at document_start');

    // Inject page script immediately
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/video/netflix/netflix-page-script.js');
    script.onload = () => {
        console.log('[Helios Netflix] Page script injected early');
        script.remove();
    };
    script.onerror = (error) => {
        console.error('[Helios Netflix] Failed to inject page script:', error);
    };

    // Inject into document as early as possible
    (document.head || document.documentElement).appendChild(script);
})();
