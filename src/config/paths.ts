/**
 * Runtime asset paths.
 *
 * Every path here is typed as WXT's `PublicPath`, a union generated from the
 * files actually present in the build. A typo or a moved asset is therefore a
 * type error rather than a 404 at runtime.
 */
import { browser } from 'wxt/browser';
import type { PublicPath } from 'wxt/browser';

export const SETTINGS_TABS = [
  'general',
  'anki',
  'vocabulary',
  'advanced',
  'popup',
  'shortcuts',
  'video-player',
] as const;

export type SettingsTabName = (typeof SETTINGS_TABS)[number];

/**
 * Tab names reach us from localStorage and DOM attributes, so they're
 * unvalidated strings until this guard narrows them.
 */
export function isSettingsTabName(value: string): value is SettingsTabName {
  return (SETTINGS_TABS as readonly string[]).includes(value);
}

export const PATHS = {
  FREQUENCY_FILES: [
    '/freq-dict/term_meta_bank_1.json',
    '/freq-dict/term_meta_bank_2.json',
    '/freq-dict/term_meta_bank_3.json',
    '/freq-dict/term_meta_bank_4.json',
    '/freq-dict/term_meta_bank_5.json',
    '/freq-dict/term_meta_bank_6.json',
    '/freq-dict/term_meta_bank_7.json',
    '/freq-dict/term_meta_bank_8.json',
    '/freq-dict/term_meta_bank_9.json',
    '/freq-dict/term_meta_bank_10.json',
    '/freq-dict/term_meta_bank_11.json',
    '/freq-dict/term_meta_bank_12.json',
  ] satisfies PublicPath[],

  HTML: {
    BANNER: '/ui/banner/banner.html',
    SIDE_TAB: '/ui/side-tab/side-tab.html',
    YOUTUBE_SIDEBAR: '/ui/youtube-sidebar/youtube-sidebar.html',
    ONBOARDING: '/onboarding.html',
    SETTINGS: '/options.html',
  } satisfies Record<string, PublicPath>,

  CSS: {
    BANNER: '/ui/banner/banner.css',
    SIDE_TAB: '/ui/side-tab/side-tab.css',
    YOUTUBE_SIDEBAR: '/ui/youtube-sidebar/youtube-sidebar.css',
    VIDEO_STYLES: '/ui/video/video-styles.css',
    POPUP: '/ui/popup/popup.css',
  } satisfies Record<string, PublicPath>,

  /** MAIN-world page scripts injected via <script src> (web accessible). */
  PAGE_SCRIPTS: {
    YOUTUBE: '/youtube-page.js',
    NETFLIX: '/netflix-page.js',
  } satisfies Record<string, PublicPath>,

  JIEBA_DICT: '/lib/jieba/dict.txt.big',

  ICONS: {
    SMALL: '/icons/icon16.png',
    MEDIUM: '/icons/icon48.png',
    LARGE: '/icons/icon128.png',
  } satisfies Record<string, PublicPath>,

  /** Settings tab HTML fragments fetched into the options page. */
  settingsTabHtml(tab: SettingsTabName): PublicPath {
    return `/ui/settings/${tab}-settings.html`;
  },

  /** Onboarding vocabulary list for a language. */
  onboardingVocab(languageCode: string): PublicPath {
    return `/OnboardingVocab/${languageCode}5k.csv` as PublicPath;
  },

  /** Full chrome-extension:// URL for a build asset. */
  url(path: PublicPath): string {
    return browser.runtime.getURL(path);
  },

  /** All frequency dictionary file paths. */
  getFrequencyFiles(): PublicPath[] {
    return [...PATHS.FREQUENCY_FILES];
  },
} as const;

// Kept on window for cross-context runtime access (legacy pattern).
if (typeof window !== 'undefined') {
  window.PATHS = PATHS;
}
