/**
 * Main Helios content script.
 *
 * The extension was originally 60+ classic content scripts loaded in a strict
 * manifest order; modules communicate through imports plus shared window.*
 * instances. The side-effect import order below preserves the original load
 * order — do not reorder without checking init dependencies.
 */
import { defineContentScript } from '#imports';

import { clearServices, provideServices } from '@/content/services';

import '@/config/paths';
import '@/content/config/constants';
import '@/content/video/config/video-constants';
import '@/content/utils/activation-controller';
import '@/content/utils/shortcut-helper';
import '@/content/utils/text-scanner';
import '@/services/screenshot-capturer';
import '@/services/audio-recorder';
import '@/services/media-storage';
import '@/content/utils/lookup-controller';
import '@/content/utils/language-switch-coordinator';
import '@/content/settings/settings-sync';
import '@/content/utils/feature-toggle';
import '@/content/utils/asbplayer-integration';
import '@/lib/jieba';
import '@/content/languages/base-language-adapter';
import '@/content/languages/chinese-adapter';
import '@/content/languages/space-separated-adapter';
import '@/content/languages/language-registry';
import '@/content/pronunciation-manager';
import '@/content/frequency-manager';
import '@/content/anki-manager';
import '@/content/pronunciation';
import '@/content/popup/components/popup-positioner';
import '@/content/popup/components/popup-content-builder';
import '@/content/popup/components/popup-event-handler';
import '@/content/popup/components/card-navigator';
import '@/content/popup/components/definition-filter';
import '@/content/popup/components/card-manager';
import '@/content/popup/popup-settings-manager';
import '@/content/popup/popup-manager';
import '@/content/popup/multi-card-popup-manager';
import '@/content/settings/content-settings-applier';
import '@/content/extensiontab';
import '@/content/text-highlighter';
import '@/content/page-processor';
import '@/content/vocab-manager';
import '@/content/dictionary-bridge';
import '@/content/dictionary-manager';
import '@/content/video/models/subtitle-entry';
import '@/content/video/models/subtitle-collection';
import '@/content/video/parsers/srt-parser';
import '@/content/video/parsers/vtt-parser';
import '@/content/video/parsers/subtitle-parser';
import '@/content/video/ui/subtitle-overlay';
import '@/content/video/ui/subtitle-list-panel';
import '@/content/video/ui/subtitle-selector-modal';
import '@/content/video/core/video-binding';
import '@/content/video/core/video-detector';
import '@/content/video/core/platform-detector';
import '@/content/video/loaders/base-subtitle-loader';
import '@/content/video/loaders/subtitle-file-loader';
import '@/content/video/loaders/youtube-subtitle-loader';
import '@/content/video/loaders/netflix-subtitle-loader';
import '@/content/video/controllers/video-ui-controller';
import '@/content/video/video-feature-manager';
import '@/content/video/youtube/theater-mode-controller';
import '@/content/video/youtube/layout-manager';
import '@/content/video/youtube/sidebar-positioner';
import '@/content/video/youtube/helios-toggle-button';
import '@/content/youtube-sidebar';
import '@/content/video/platform-video-sidebar';
import '@/content/content';
import '@/content/banner-manager';
import '@/content/banner';
import '@/content/side-tab';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  main(ctx) {
    // Publish the script's lifetime so features can register timers and
    // listeners that are torn down automatically when the context is
    // invalidated (extension reload, or SPA navigation off the page).
    provideServices({ ctx });
    ctx.onInvalidated(clearServices);

    // Feature initialization happens as module side effects, matching the
    // original classic-script load order above.
  },
});
