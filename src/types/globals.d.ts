/**
 * Central declarations for Helios globals attached to `window`.
 *
 * The extension runs the same modules in several contexts (content scripts,
 * popup, options, onboarding, offscreen). Runtime instances and a few
 * constructors are shared across modules via `window.*` — declared here once.
 */

import type { AnkiManager } from '@/content/anki-manager';
import type { BannerManager } from '@/content/banner-manager';
import type { DictionaryManagerProxy } from '@/content/dictionary-bridge';
import type { DictionaryManager } from '@/content/dictionary-manager';
import type { LanguageRegistry } from '@/content/languages/language-registry';
import type { PopupManager } from '@/content/popup/popup-manager';
import type { PageProcessor } from '@/content/page-processor';
import type { PronunciationManager } from '@/content/pronunciation-manager';
import type { ContentSettingsApplier } from '@/content/settings/content-settings-applier';
import type { HeliosSettingsManager } from '@/content/settings/helios-settings';
import type { HighlightManager } from '@/content/text-highlighter';
import type { ShortcutHelper } from '@/content/utils/shortcut-helper';
import type { PlatformDetector } from '@/content/video/core/platform-detector';
import type { PlatformVideoSidebar } from '@/content/video/platform-video-sidebar';
import type { SubtitleSelectorModal } from '@/content/video/ui/subtitle-selector-modal';
import type { VideoFeatureManager } from '@/content/video/video-feature-manager';
import type { VocabManager } from '@/content/vocab-manager';
import type { YouTubeSidebar } from '@/content/youtube-sidebar';
import type { HeliosAudioRecorder } from '@/services/audio-recorder';
import type { ScreenshotCapturer } from '@/services/screenshot-capturer';

declare global {
  interface Window {
    // ---- Runtime instances (created during content/page init) ----
    dictionaryManager: DictionaryManager | DictionaryManagerProxy;
    vocabManager: VocabManager;
    languageRegistry: LanguageRegistry;
    pageProcessor: PageProcessor;
    highlightManager: HighlightManager;
    popupManager: PopupManager;
    pronunciationManager: PronunciationManager;
    bannerManager: BannerManager;
    /** Alias of bannerManager (legacy name). */
    sidebarManager: BannerManager;
    heliosSettings: HeliosSettingsManager;

    // Maybe-present instances, depending on page/feature state.
    heliosVideoFeature?: VideoFeatureManager | null;
    platformVideoSidebar?: PlatformVideoSidebar | null;
    youtubeSidebar?: YouTubeSidebar | null;
    subtitleSelectorModal?: SubtitleSelectorModal | null;
    heliosPageProcessor?: PageProcessor;
    /** Legacy: pinyin manager was removed; reads must handle absence. */
    pinyinManager?: undefined;

    // ---- Constructors exposed for cross-context/legacy access ----
    AnkiManager: typeof AnkiManager;
    ContentSettingsApplier: typeof ContentSettingsApplier;
    PlatformDetector: typeof PlatformDetector;
    ShortcutHelper: typeof ShortcutHelper;
    HeliosAudioRecorder: HeliosAudioRecorder;
    HeliosScreenshotCapturer: ScreenshotCapturer;
    /** Legacy: wikimedia audio provider was removed; reads must handle absence. */
    WikimediaAudioProvider?: undefined;

    // ---- Third-party page globals (YouTube page context) ----
    ytcfg?: { data_?: Record<string, unknown>; get?: (key: string) => unknown };
    ytInitialData?: Record<string, unknown>;
  }
}

export {};
