/**
 * Centralized runtime asset paths.
 *
 * All paths are relative to the built extension root (WXT output). Assets that
 * are fetched at runtime live in `src/public/` and keep these stable URLs.
 */

export type SettingsTabName =
  | 'general'
  | 'anki'
  | 'vocabulary'
  | 'advanced'
  | 'popup'
  | 'shortcuts'
  | 'video-player';

export const PATHS = {
  FREQ_DICT: 'freq-dict/',

  FREQUENCY_FILES: [
    'term_meta_bank_1.json',
    'term_meta_bank_2.json',
    'term_meta_bank_3.json',
    'term_meta_bank_4.json',
    'term_meta_bank_5.json',
    'term_meta_bank_6.json',
    'term_meta_bank_7.json',
    'term_meta_bank_8.json',
    'term_meta_bank_9.json',
    'term_meta_bank_10.json',
    'term_meta_bank_11.json',
    'term_meta_bank_12.json',
  ],

  HTML: {
    BANNER: 'ui/banner/banner.html',
    SIDE_TAB: 'ui/side-tab/side-tab.html',
    YOUTUBE_SIDEBAR: 'ui/youtube-sidebar/youtube-sidebar.html',
    ONBOARDING: 'onboarding.html',
    SETTINGS: 'options.html',
  },

  CSS: {
    BANNER: 'ui/banner/banner.css',
    SIDE_TAB: 'ui/side-tab/side-tab.css',
    YOUTUBE_SIDEBAR: 'ui/youtube-sidebar/youtube-sidebar.css',
    VIDEO_STYLES: 'ui/video/video-styles.css',
    POPUP: 'ui/popup/popup.css',
  },

  /** MAIN-world page scripts injected via <script src> (web accessible). */
  PAGE_SCRIPTS: {
    YOUTUBE: 'youtube-page.js',
    NETFLIX: 'netflix-page.js',
  },

  JIEBA_DICT: 'lib/jieba/dict.txt.big',

  /** Settings tab HTML fragments fetched into the options page. */
  settingsTabHtml(tab: SettingsTabName | string): string {
    return `ui/settings/${tab}-settings.html`;
  },

  /** Full chrome-extension:// URL for a path relative to the extension root. */
  url(path: string): string {
    return chrome.runtime.getURL(path);
  },

  /** All frequency dictionary file paths. */
  getFrequencyFiles(): string[] {
    return PATHS.FREQUENCY_FILES.map((file) => `${PATHS.FREQ_DICT}${file}`);
  },
} as const;

// Kept on window for cross-context runtime access (legacy pattern).
if (typeof window !== 'undefined') {
  window.PATHS = PATHS;
}
