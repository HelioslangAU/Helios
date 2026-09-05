/**
 * Central declarations for Helios globals attached to `window`.
 *
 * The extension runs the same modules in several contexts (content scripts,
 * popup, options, onboarding, offscreen). Runtime instances and a few
 * constructors are shared across modules via `window.*` — declared here once.
 */

import type { PATHS } from '@/config/paths';
import type { AnkiManager } from '@/content/anki-manager';
import type { BannerManager } from '@/content/banner-manager';
import type { DictionaryBridge, DictionaryManagerProxy, DictionaryProxy } from '@/content/dictionary-bridge';
import type { DictionaryManager } from '@/content/dictionary-manager';
import type { FrequencyManager } from '@/content/frequency-manager';
import type { BaseLanguageAdapter } from '@/content/languages/base-language-adapter';
import type { ChineseLanguageAdapter } from '@/content/languages/chinese-adapter';
import type { LanguageRegistry } from '@/content/languages/language-registry';
import type {
  EnglishLanguageAdapter,
  FrenchLanguageAdapter,
  SpaceSeparatedLanguageAdapter,
  SpanishLanguageAdapter,
} from '@/content/languages/space-separated-adapter';
import type { FirstRunDetector } from '@/content/onboarding/first-run-detector';
import type { OnboardingController } from '@/content/onboarding/onboarding-controller';
import type { LanguageSelector } from '@/content/components/language-selector/language-selector';
import type { PopupManager } from '@/content/popup/popup-manager';
import type { PopupSettingsManager } from '@/content/popup/popup-settings-manager';
import type { PageProcessor } from '@/content/page-processor';
import type { PronunciationManager } from '@/content/pronunciation-manager';
import type { ContentSettingsApplier } from '@/content/settings/content-settings-applier';
import type { HeliosSettingsManager } from '@/content/settings/helios-settings';
import type { HeliosSettingsAdvanced } from '@/content/settings/settings-advanced';
import type { HeliosSettingsAnki } from '@/content/settings/settings-anki';
import type { HeliosSettingsStorage } from '@/content/settings/settings-storage';
import type { HeliosSettingsUI } from '@/content/settings/settings-ui';
import type { HeliosSettingsVocabulary } from '@/content/settings/settings-vocabulary';
import type { HighlightManager } from '@/content/text-highlighter';
import type { LanguageSwitchCoordinator } from '@/content/utils/language-switch-coordinator';
import type { ShortcutHelper } from '@/content/utils/shortcut-helper';
import type { VideoConstants } from '@/content/video/config/video-constants';
import type { PlatformDetector } from '@/content/video/core/platform-detector';
import type { PlatformVideoSidebar } from '@/content/video/platform-video-sidebar';
import type { SubtitleSelectorModal } from '@/content/video/ui/subtitle-selector-modal';
import type { VideoFeatureManager } from '@/content/video/video-feature-manager';
import type { VocabManager } from '@/content/vocab-manager';
import type { YouTubeSidebar } from '@/content/youtube-sidebar';
import type { HeliosAudioRecorder } from '@/services/audio-recorder';
import type { MediaStorage } from '@/services/media-storage';
import type { ScreenshotCapturer } from '@/services/screenshot-capturer';
import type { Jieba } from '@/lib/jieba';

declare global {
  interface Window {
    // ---- Shared config ----
    PATHS: typeof PATHS;
    VideoConstants: typeof VideoConstants;

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
    languageSwitchCoordinator: LanguageSwitchCoordinator;
    heliosSettings: HeliosSettingsManager;

    // Maybe-present instances, depending on page/feature state.
    heliosVideoFeature?: VideoFeatureManager;
    heliosVideo?: VideoFeatureManager;
    platformVideoSidebar?: PlatformVideoSidebar;
    youtubeSidebar?: YouTubeSidebar;
    subtitleSelectorModal?: SubtitleSelectorModal;
    heliosPageProcessor?: PageProcessor;
    /** Action-popup page namespace (extensiontab). */
    heliosExtension?: Record<string, (...args: never[]) => unknown>;
    /** Legacy: pinyin manager was removed; reads must handle absence. */
    pinyinManager?: undefined;

    // ---- Constructors exposed for cross-context/legacy access ----
    AnkiManager: typeof AnkiManager;
    BaseLanguageAdapter: typeof BaseLanguageAdapter;
    ChineseLanguageAdapter: typeof ChineseLanguageAdapter;
    SpaceSeparatedLanguageAdapter: typeof SpaceSeparatedLanguageAdapter;
    EnglishLanguageAdapter: typeof EnglishLanguageAdapter;
    SpanishLanguageAdapter: typeof SpanishLanguageAdapter;
    FrenchLanguageAdapter: typeof FrenchLanguageAdapter;
    LanguageRegistry: typeof LanguageRegistry;
    LanguageSelector: typeof LanguageSelector;
    LanguageSwitchCoordinator: typeof LanguageSwitchCoordinator;
    DictionaryBridge: typeof DictionaryBridge;
    DictionaryProxy: typeof DictionaryProxy;
    DictionaryManagerProxy: typeof DictionaryManagerProxy;
    FrequencyManager: typeof FrequencyManager;
    PronunciationManager: typeof PronunciationManager;
    PopupSettingsManager: typeof PopupSettingsManager;
    ContentSettingsApplier: typeof ContentSettingsApplier;
    PlatformDetector: typeof PlatformDetector;
    ShortcutHelper: typeof ShortcutHelper;
    FirstRunDetector: typeof FirstRunDetector;
    OnboardingController: typeof OnboardingController;
    HeliosSettingsManager: typeof HeliosSettingsManager;
    HeliosSettingsStorage: typeof HeliosSettingsStorage;
    HeliosSettingsUI: typeof HeliosSettingsUI;
    HeliosSettingsAnki: typeof HeliosSettingsAnki;
    HeliosSettingsVocabulary: typeof HeliosSettingsVocabulary;
    HeliosSettingsAdvanced: typeof HeliosSettingsAdvanced;
    HeliosAudioRecorder: typeof HeliosAudioRecorder;
    HeliosMediaStorage: typeof MediaStorage;
    HeliosScreenshotCapturer: typeof ScreenshotCapturer;
    Jieba: typeof Jieba;
    /** Legacy: wikimedia audio provider was removed; reads must handle absence. */
    WikimediaAudioProvider?: undefined;

    // ---- Third-party page globals (YouTube page context) ----
    ytcfg?: { data_?: Record<string, unknown>; get?: (key: string) => unknown };
    ytInitialData?: Record<string, unknown>;
  }
}

export {};
