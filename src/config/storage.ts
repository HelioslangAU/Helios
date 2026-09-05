/**
 * Typed wrapper around `chrome.storage.local`.
 *
 * Every key Helios persists is declared in `HeliosStorage` below, so reads and
 * writes are checked instead of returning `unknown`. Reads are partial — a key
 * is absent until something writes it, which is why call sites keep their
 * `?? default` fallbacks.
 */

export interface HotkeyBinding {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta?: boolean;
}

export interface VideoPlayerSettings {
  hotkeysEnabled: boolean;
  dualSubtitlesEnabled: boolean;
  secondarySubtitleLanguage: string | null;
  pauseOnHover: boolean;
  pauseAtEnd: boolean;
  autoPlayAfterNav: boolean;
  hotkeys: Record<string, HotkeyBinding>;
}

export interface ShortcutSettings {
  popup?: Record<string, string>;
  video?: Record<string, HotkeyBinding>;
  videoNavigation?: Record<string, HotkeyBinding>;
  [key: string]: unknown;
}

export interface AnkiSettings {
  deck?: string;
  noteType?: string;
  fieldMappings?: Record<string, string>;
  checkDuplicates?: boolean;
  allowDuplicates?: boolean;
  includeSentence?: boolean;
  tags?: string[];
  importYoungAsLearning?: boolean;
  autoSyncLearningWords?: boolean;
  [key: string]: unknown;
}

export interface VocabEntry {
  word?: string;
  character?: string;
  definition?: string;
  pinyin?: string;
  dateAdded?: string;
  reviewCount?: number;
  [key: string]: unknown;
}

/** Every key Helios reads from or writes to `chrome.storage.local`. */
export interface HeliosStorage {
  // Core state
  extensionEnabled: boolean;
  targetLanguage: string;
  nativeLanguage: string;
  activationKey: string;
  autoHighlight: boolean;
  popupTheme: string;

  // Vocabulary
  vocabList: VocabEntry[];
  knownWords: string[];
  knownWordsByLanguage: Record<string, string[]>;
  ignoredWordsByLanguage: Record<string, string[]>;
  learningWordsByLanguage: Record<string, string[]>;
  chineseExtensionKnownWords: string[];
  chineseExtensionIgnoredWords: string[];
  chineseExtensionVocabList: VocabEntry[];

  // Session counters
  sessionCount: number;
  todayLookupCount: number;
  totalLookups: number;
  todayLookups: number;
  lastResetDate: string;
  ankiCardsCreated: number;

  // Anki
  ankiSettings: AnkiSettings;
  ankiCardsToday: number;
  ankiSuccessCount: number;
  ankiTotalAttempts: number;
  ankiSuccessRate: number;
  lastAnkiResetDate: string;

  // Video / subtitles
  videoFeatureEnabled: boolean;
  videoPlayer: VideoPlayerSettings;
  subtitleSettings: Record<string, unknown>;
  subtitlePreferences: Record<string, unknown>;
  platformSidebarSettings: Record<string, unknown>;
  /** Legacy, migrated into `videoPlayer` on load. */
  ytSidebarSettings: Record<string, unknown>;

  // Shortcuts
  shortcuts: ShortcutSettings;

  // Onboarding / install metadata
  hasCompletedOnboarding: boolean;
  installDate: string;
  extensionVersion: string;
  extensionLastUpdateDate: string;

  // Options-page settings. These are written as one bag by the settings form
  // (see HeliosSettingsStorage.saveSettings) and read back into defaults.
  scanDelay: number;
  maxWordLength: number;
  preferTraditional: boolean;
  popupFontSize: string;
  showFrequency: boolean;
  persistentPopup: boolean;
  autoCloseDelay: number;
  highlightStyle: string;
  highlightColor: string;
  highlightIntensity: string;
  hideKnownSites: boolean;
  videoNavigationBehavior: { autoPlayAfterNav: boolean };
  hotkeyMarkUnknown: string;
  hotkeyMarkIgnored: string;
  hotkeyMarkKnown: string;
  hotkeyAnkiAdd: string;
  ankiDeck: string;
  ankiNoteType: string;
  ankiCheckDuplicates: boolean;
  ankiIncludeSentence: boolean;
  ankiFieldMappings: Record<string, string>;
  ankiImportYoungAsLearning: boolean;
  ankiAutoSyncLearningWords: boolean;
  processingMode: string;
  cacheDictionary: boolean;
  maxElements: number;
  backgroundProcessing: boolean;
  autoDetectChinese: boolean;
  workIncognito: boolean;
  disabledSites: string[];
  debugMode: boolean;
  showMetrics: boolean;

  /** Per-language recent lookups, keyed at runtime by language code. */
  [recentVocabKey: `recentVocab_${string}`]: VocabEntry[];
}

export type HeliosStorageKey = keyof HeliosStorage;

/** A read result: every requested key may be absent. */
export type StorageResult<K extends HeliosStorageKey> = Partial<Pick<HeliosStorage, K>>;

export const storage = {
  /** Read one or more known keys. Absent keys come back `undefined`. */
  get<K extends HeliosStorageKey>(keys: K | K[]): Promise<StorageResult<K>> {
    return chrome.storage.local.get<StorageResult<K>>(keys);
  },

  /** Read everything, including keys owned by the settings page. */
  getAll(): Promise<Partial<HeliosStorage> & Record<string, unknown>> {
    return chrome.storage.local.get<Partial<HeliosStorage> & Record<string, unknown>>(null);
  },

  /** Write known keys. */
  set(items: Partial<HeliosStorage>): Promise<void> {
    return chrome.storage.local.set(items);
  },

  /**
   * Write a settings bag whose keys are only known at runtime (the options page
   * collects arbitrary form fields).
   */
  setRaw(items: Record<string, unknown>): Promise<void> {
    return chrome.storage.local.set(items);
  },

  remove(keys: HeliosStorageKey | HeliosStorageKey[]): Promise<void> {
    return chrome.storage.local.remove<HeliosStorage>(keys);
  },
} as const;
