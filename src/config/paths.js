/**
 * Centralized File Paths Configuration
 * 
 * This file contains all file paths used throughout the Helios extension.
 * When you need to change file structure, update paths here instead of 
 * searching through all files manually.
 */

class PathsConfig {
  constructor() {
    // Base directories
    this.BASE = '';
    this.SRC = 'src/';
    this.UI = 'src/ui/';
    this.SETTINGS = 'src/settings/';
    this.STYLES = 'styles/';
    this.ICONS = 'icons/';
    this.FREQ_DICT = 'freq-dict/';
    this.BANNER = 'src/ui/banner/';
    this.SIDE_TAB = 'src/ui/side-tab/';
    this.SIDEBAR = 'src/ui/sidebar/';
    this.POPUP = 'src/ui/popup/';
    this.TAB = 'src/ui/tab/';
    this.SETTINGS_UI = 'src/ui/settings/';

    // Core files
    this.MANIFEST = 'manifest.json';
    this.BACKGROUND = 'background.js';
    this.CEDICT = 'cedict_ts.u8';

    // Content scripts
    this.CONTENT_SCRIPTS = [
      'src/content/frequency-manager.js',
      'src/content/anki-manager.js',
      'src/content/pronunciation.js',
      'src/content/popup/popup-manager.js',
      'src/content/popup/multi-card-popup-manager.js',
      'src/content/extensiontab.js',
      'src/content/text-highlighter.js',
      'src/content/page-processor.js',
      'src/content/vocab-manager.js',
      'src/content/dictionary-manager.js',
      'src/content/content.js',
      'src/content/sidebar-manager.js',
      'src/ui/sidebar/smart-sidebar.js'
    ];

    // CSS files
    this.CSS = {
      POPUP: 'src/ui/popup/popup.css',
      HELIOS_SETTINGS: 'src/ui/settings/helios-settings.css',
      BANNER: 'src/ui/banner/banner.css',
      SIDE_TAB: 'src/ui/side-tab/side-tab.css',
      SIDEBAR: 'src/ui/sidebar/smart-sidebar.css'
    };

    // HTML files
    this.HTML = {
      EXTENSION_TAB: 'src/ui/tab/extensiontab.html',
      HELIOS_SETTINGS: 'src/ui/settings/helios-settings.html',
      BANNER: 'src/ui/banner/banner.html',
      SIDE_TAB: 'src/ui/side-tab/side-tab.html',
      SIDEBAR: 'src/ui/sidebar/smart-sidebar.html',
      GENERAL_SETTINGS: 'src/ui/settings/general-settings.html',
      ANKI_SETTINGS: 'src/ui/settings/anki-settings.html',
      VOCABULARY_SETTINGS: 'src/ui/settings/vocabulary-settings.html',
      ADVANCED_SETTINGS: 'src/ui/settings/advanced-settings.html',
      POPUP_SETTINGS: 'src/ui/settings/popup-settings.html'
    };

    // JavaScript modules
    this.JS = {
      // Settings modules
      HELIOS_SETTINGS: 'src/content/settings/helios-settings.js',
      SETTINGS_STORAGE: 'src/content/settings/settings-storage.js',
      SETTINGS_UI: 'src/content/settings/settings-ui.js',
      SETTINGS_ANKI: 'src/content/settings/settings-anki.js',
      SETTINGS_VOCABULARY: 'src/content/settings/settings-vocabulary.js',
      SETTINGS_ADVANCED: 'src/content/settings/settings-advanced.js',
      
      // Core modules
      VOCAB_MANAGER: 'src/content/vocab-manager.js',
      EXTENSION_TAB: 'src/content/extensiontab.js',
      BANNER: 'src/content/banner.js',
      SIDE_TAB: 'src/content/side-tab.js',
      SIDEBAR: 'src/ui/sidebar/smart-sidebar.js'
    };

    // Icons
    this.ICONS = {
      ICON_16: 'icons/icon16.png',
      ICON_48: 'icons/icon48.png',
      ICON_128: 'icons/icon128.png'
    };

    // Frequency dictionary files
    this.FREQUENCY_FILES = [
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
      'term_meta_bank_12.json'
    ];

    // Web accessible resources
    this.WEB_ACCESSIBLE_RESOURCES = [
      'dictionary.json',
      'src/ui/popup/popup.css',
      'cedict_ts.u8',
      'freq-dict/*',
      'src/ui/settings/helios-settings.html',
      'src/settings/helios-settings.js',
      'src/settings/settings-storage.js',
      'src/content/settings/settings-ui.js',
      'src/content/settings/settings-anki.js',
      'src/content/settings/settings-vocabulary.js',
      'src/content/settings/settings-advanced.js',
      'src/settings/*',
      'src/ui/settings/*',
      'styles/*',
      'src/ui/*',
      'src/ui/banner/banner.html',
      'src/ui/banner/banner.css',
      'src/content/banner.js',
      'src/ui/side-tab/side-tab.html',
      'src/ui/side-tab/side-tab.css',
      'src/content/side-tab.js',
      'src/ui/sidebar/smart-sidebar.html',
      'src/ui/sidebar/smart-sidebar.css',
      'src/ui/sidebar/smart-sidebar.js'
    ];
  }

  /**
   * Get the full path for a file
   * @param {string} path - The path key or direct path
   * @returns {string} - The full path
   */
  getPath(path) {
    // If it's a direct path, return as is
    if (path.includes('/')) {
      return path;
    }
    
    // If it's a nested object path like 'CSS.POPUP'
    if (path.includes('.')) {
      const parts = path.split('.');
      let current = this;
      for (const part of parts) {
        current = current[part];
        if (current === undefined) {
          console.warn(`Path not found: ${path}`);
          return path;
        }
      }
      return current;
    }
    
    // If it's a direct property
    return this[path] || path;
  }

  /**
   * Get Chrome runtime URL for a file
   * @param {string} path - The path key or direct path
   * @returns {string} - The Chrome runtime URL
   */
  getChromeURL(path) {
    const filePath = this.getPath(path);
    return chrome.runtime.getURL(filePath);
  }

  /**
   * Get all frequency dictionary file paths
   * @returns {string[]} - Array of frequency file paths
   */
  getFrequencyFiles() {
    return this.FREQUENCY_FILES.map(file => `${this.FREQ_DICT}${file}`);
  }

  /**
   * Get all content script paths
   * @returns {string[]} - Array of content script paths
   */
  getContentScripts() {
    return this.CONTENT_SCRIPTS;
  }

  /**
   * Get all web accessible resources
   * @returns {string[]} - Array of web accessible resource paths
   */
  getWebAccessibleResources() {
    return this.WEB_ACCESSIBLE_RESOURCES;
  }

  /**
   * Get all icon paths for manifest
   * @returns {Object} - Object with icon sizes as keys and paths as values
   */
  getIcons() {
    return this.ICONS;
  }
}

// Create and export a singleton instance
const PATHS = new PathsConfig();

// Make it available globally
if (typeof window !== 'undefined') {
  window.PATHS = PATHS;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PATHS;
}

// Export for ES6 modules
if (typeof exports !== 'undefined') {
  exports.PATHS = PATHS;
}