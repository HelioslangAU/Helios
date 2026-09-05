/**
 * Language Registry
 *
 * Central registry for managing language adapters and switching between languages.
 * Provides a unified interface for language-specific operations.
 */
import type { BaseLanguageAdapter, ExtractedWord, LanguageConfig } from '@/content/languages/base-language-adapter';
import { ChineseLanguageAdapter } from '@/content/languages/chinese-adapter';
import {
  EnglishLanguageAdapter,
  FrenchLanguageAdapter,
  SpanishLanguageAdapter,
} from '@/content/languages/space-separated-adapter';

export class LanguageRegistry {
  adapters: Map<string, BaseLanguageAdapter>;
  currentAdapter: BaseLanguageAdapter | null;
  currentLanguageCode: string | null;
  eventListeners: Map<string, Array<(data: any) => void>>;

  constructor() {
    this.adapters = new Map();
    this.currentAdapter = null;
    this.currentLanguageCode = null;
    this.eventListeners = new Map();
  }

  /**
   * Register a language adapter
   * @param languageCode - ISO 639-1 language code (e.g., 'zh', 'en', 'es')
   * @param adapter - Language adapter instance
   */
  register(languageCode: string, adapter: BaseLanguageAdapter): void {
    if (!adapter || typeof adapter.isTargetCharacter !== 'function') {
      throw new Error('Invalid adapter: must extend BaseLanguageAdapter');
    }

    this.adapters.set(languageCode, adapter);
    console.log(`Registered language adapter: ${languageCode} (${adapter.getDisplayName()})`);
  }

  /**
   * Set the active language
   * @param languageCode - Language code to switch to
   * @returns True if language was switched successfully
   */
  setLanguage(languageCode: string): boolean {
    // Lazy-load adapter if not already initialized
    if (!this.adapters.has(languageCode)) {
      if (!this.initializeLanguageAdapter(languageCode)) {
        console.error(`Language adapter not found and could not be initialized: ${languageCode}`);
        return false;
      }
    }

    const previousLanguage = this.currentLanguageCode;
    this.currentLanguageCode = languageCode;
    this.currentAdapter = this.adapters.get(languageCode)!;

    console.log(`Switched to language: ${languageCode} (${this.currentAdapter.getDisplayName()})`);

    // Emit language change event
    this.emit('languageChanged', {
      previousLanguage,
      currentLanguage: languageCode,
      adapter: this.currentAdapter
    });

    return true;
  }

  /**
   * Get the current language adapter
   * @returns Current adapter or null if none set
   */
  getAdapter(): BaseLanguageAdapter | null {
    return this.currentAdapter;
  }

  /**
   * Get the current language code
   * @returns Current language code or null if none set
   */
  getCurrentLanguage(): string | null {
    return this.currentLanguageCode;
  }


  /**
   * Get all registered language adapters
   * @returns Map of language codes to adapters
   */
  getAllAdapters(): Map<string, BaseLanguageAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Get available language codes
   * @returns Array of registered language codes
   */
  getAvailableLanguages(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get language information
   * @param languageCode - Language code to get info for
   * @returns Language config or null if not found
   */
  getLanguageInfo(languageCode: string): LanguageConfig | null {
    const adapter = this.adapters.get(languageCode);
    return adapter ? adapter.getConfig() : null;
  }

  getScanResolution(languageCode: string): string | null {
    const adapter = this.adapters.get(languageCode);
    return adapter ? adapter.getConfig().scanResolution : null;
  }

  getCaseSensitive(languageCode: string): boolean {
    const adapter = this.adapters.get(languageCode);
    return adapter ? adapter.getConfig().caseSensitive : false;
  }

  /**
   * Check if a language is registered
   * @param languageCode - Language code to check
   * @returns True if language is registered
   */
  hasLanguage(languageCode: string): boolean {
    return this.adapters.has(languageCode);
  }

  /**
   * Get dictionary path for current language
   * @returns Dictionary path or null if no language set
   */
  getDictionaryPath(): string | undefined | null {
    return this.currentAdapter ? this.currentAdapter.getDictionaryPath() : null;
  }

  /**
   * Check if character belongs to current language
   * @param char - Character to check
   * @returns True if character belongs to current language
   */
  isTargetCharacter(char: string): boolean {
    return this.currentAdapter ? this.currentAdapter.isTargetCharacter(char) : false;
  }

  /**
   * Extract words from text using current language
   * @param text - Text to process
   * @param dictionary - Dictionary to validate against
   * @returns Array of word objects
   */
  async extractWords(text: string, dictionary: any): Promise<ExtractedWord[]> {
    if (!this.currentAdapter) return [];
    const result = this.currentAdapter.extractWords(text, dictionary);
    // Handle both sync and async adapters
    return result instanceof Promise ? await result : result;
  }

  /**
   * Parse dictionary using current language
   * @param dictionaryText - Raw dictionary text
   * @returns Parsed dictionary
   */
  parseDictionary(dictionaryText: string): Record<string, any[]> {
    return this.currentAdapter ? this.currentAdapter.parseDictionary(dictionaryText) : {};
  }

  /**
   * Get pronunciation for word using current language
   * @param word - Word to get pronunciation for
   * @param entries - Dictionary entries
   * @returns Pronunciation or null
   */
  getPronunciation(word: string, entries: any[]): string | null {
    return this.currentAdapter ? this.currentAdapter.getPronunciation(word, entries) : null;
  }

  /**
   * Get sentence boundary regex for current language
   * @returns Sentence boundary regex or null
   */
  getSentenceBoundary(): RegExp | null {
    return this.currentAdapter ? this.currentAdapter.getSentenceBoundary() : null;
  }


  /**
   * Check if text contains current language characters
   * @param text - Text to check
   * @returns True if text contains target language characters
   */
  containsTargetLanguage(text: string): boolean {
    return this.currentAdapter ? this.currentAdapter.containsTargetLanguage(text) : false;
  }



  /**
   * Add event listener
   * @param event - Event name
   * @param callback - Event callback
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   * @param event - Event name
   * @param callback - Event callback to remove
   */
  off(event: string, callback: (data: any) => void): void {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param event - Event name
   * @param data - Event data
   */
  emit(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Initialize a specific language adapter
   * @param languageCode - Language code to initialize (e.g., 'zh', 'en', 'es', 'fr')
   * @returns True if adapter was initialized successfully
   */
  initializeLanguageAdapter(languageCode: string): boolean {
    // If already initialized, return true
    if (this.adapters.has(languageCode)) {
      return true;
    }

    let adapter: BaseLanguageAdapter | null = null;

    switch (languageCode) {
      case 'zh':
        if (typeof ChineseLanguageAdapter !== 'undefined') {
          adapter = new ChineseLanguageAdapter();
        }
        break;
      case 'en':
        if (typeof EnglishLanguageAdapter !== 'undefined') {
          adapter = new EnglishLanguageAdapter();
        }
        break;
      case 'es':
        if (typeof SpanishLanguageAdapter !== 'undefined') {
          adapter = new SpanishLanguageAdapter();
        }
        break;
      case 'fr':
        if (typeof FrenchLanguageAdapter !== 'undefined') {
          adapter = new FrenchLanguageAdapter();
        }
        break;
      default:
        console.warn(`Unknown language code: ${languageCode}`);
        return false;
    }

    if (adapter) {
      this.register(languageCode, adapter);
      console.log(`Initialized language adapter: ${languageCode}`);
      return true;
    }

    console.warn(`Language adapter class not available for: ${languageCode}`);
    return false;
  }

  /**
   * Initialize default language adapters (all languages)
   * Use initializeLanguageAdapter() for better performance when only one language is needed
   */
  initializeDefaultAdapters(): void {
    // Register Chinese adapter
    if (typeof ChineseLanguageAdapter !== 'undefined') {
      this.register('zh', new ChineseLanguageAdapter());
    }

    // Register English adapter
    if (typeof EnglishLanguageAdapter !== 'undefined') {
      this.register('en', new EnglishLanguageAdapter());
    }

    // Register Spanish adapter
    if (typeof SpanishLanguageAdapter !== 'undefined') {
      this.register('es', new SpanishLanguageAdapter());
    }

    // Register French adapter
    if (typeof FrenchLanguageAdapter !== 'undefined') {
      this.register('fr', new FrenchLanguageAdapter());
    }

    console.log(`Initialized ${this.adapters.size} language adapters`);
  }

  /**
   * Get language display names for UI
   * @returns Array of {code, name, displayName} objects
   */
  getLanguageOptions(): Array<{ code: string; name: string; displayName: string }> {
    const options: Array<{ code: string; name: string; displayName: string }> = [];
    for (const [code, adapter] of this.adapters) {
      const config = adapter.getConfig();
      options.push({
        code,
        name: config.name,
        displayName: config.displayName || config.name
      });
    }
    return options.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Validate language code
   * @param languageCode - Language code to validate
   * @returns True if valid language code
   */
  isValidLanguageCode(languageCode: string): boolean {
    return typeof languageCode === 'string' &&
           languageCode.length === 2 &&
           this.adapters.has(languageCode);
  }
}

// Export for use in other modules
window.LanguageRegistry = LanguageRegistry;
