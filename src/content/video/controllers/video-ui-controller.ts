import { browser } from 'wxt/browser';
import { items } from '@/config/storage';
import { ShortcutHelper } from '@/content/utils/shortcut-helper';
import { SubtitleSelectorModal } from '@/content/video/ui/subtitle-selector-modal';
import type { VideoDetector } from '@/content/video/core/video-detector';
import type { SubtitleFileLoader } from '@/content/video/loaders/subtitle-file-loader';
import type { YouTubeSubtitleLoader } from '@/content/video/loaders/youtube-subtitle-loader';
import type { NetflixSubtitleLoader } from '@/content/video/loaders/netflix-subtitle-loader';

/**
 * Controls video UI elements (load button, shortcuts, etc.)
 */
export class VideoUIController {
  videoDetector: VideoDetector;
  fileLoader: SubtitleFileLoader;
  youtubeLoader: YouTubeSubtitleLoader;
  netflixLoader: NetflixSubtitleLoader;
  subtitleSelector: SubtitleSelectorModal | null;
  isInitialized: boolean;
  hasAutoLoaded: boolean;
  isCurrentlyLoading: boolean;
  languageMap: Record<string, string[]>;
  _keyboardListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(videoDetector: VideoDetector, fileLoader: SubtitleFileLoader, youtubeLoader: YouTubeSubtitleLoader, netflixLoader: NetflixSubtitleLoader) {
    this.videoDetector = videoDetector;
    this.fileLoader = fileLoader;
    this.youtubeLoader = youtubeLoader;
    this.netflixLoader = netflixLoader;
    this.subtitleSelector = null;
    this.isInitialized = false;
    this.hasAutoLoaded = false;
    this.isCurrentlyLoading = false;

    // Language code mappings (extension language -> YouTube language codes)
    // Supports both 2-letter codes (zh, en, es) and full names (chinese, english, spanish)
    this.languageMap = {
      // Chinese
      'chinese': ['zh-Hans', 'zh-CN', 'zh', 'zh-TW', 'zh-HK'],
      'zh': ['zh-Hans', 'zh-CN', 'zh', 'zh-TW', 'zh-HK'],
      // Japanese
      'japanese': ['ja', 'jp'],
      'ja': ['ja', 'jp'],
      // Korean
      'korean': ['ko', 'kr'],
      'ko': ['ko', 'kr'],
      // Spanish
      'spanish': ['es', 'es-ES', 'es-419'],
      'es': ['es', 'es-ES', 'es-419'],
      // French
      'french': ['fr', 'fr-FR'],
      'fr': ['fr', 'fr-FR'],
      // German
      'german': ['de', 'de-DE'],
      'de': ['de', 'de-DE'],
      // Italian
      'italian': ['it', 'it-IT'],
      'it': ['it', 'it-IT'],
      // Portuguese
      'portuguese': ['pt', 'pt-BR', 'pt-PT'],
      'pt': ['pt', 'pt-BR', 'pt-PT'],
      // Russian
      'russian': ['ru', 'ru-RU'],
      'ru': ['ru', 'ru-RU'],
      // Arabic
      'arabic': ['ar'],
      'ar': ['ar'],
      // Hindi
      'hindi': ['hi'],
      'hi': ['hi'],
      // English
      'english': ['en', 'en-US', 'en-GB'],
      'en': ['en', 'en-US', 'en-GB']
    };
  }

  /**
   * Initialize UI controls
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    this.subtitleSelector = new SubtitleSelectorModal();
    try {
      await this._setupKeyboardShortcuts();
    } catch (err) {
      console.error('[VideoUIController] Error setting up keyboard shortcuts:', err);
    }
    this._setupAutoLoad();
    this._setupLanguageChangeListener();

    this.isInitialized = true;

    // Immediately trigger auto-load if video is already detected
    if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
      const binding = this.videoDetector.getPrimaryBinding();
      if (binding) {
        setTimeout(() => this.autoLoadSubtitles(), 1500);
      }
    }

    // Auto-load Netflix subtitles if on Netflix
    if (this.netflixLoader && this.netflixLoader.isNetflixPage()) {
      setTimeout(() => this.autoLoadNetflixSubtitles(), 2000);
    }
  }

  /**
   * Setup automatic subtitle loading (YouTube and Netflix)
   */
  _setupAutoLoad(): void {
    // YouTube URL change monitoring
    if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;

          // Clear old subtitles from previous video
          const binding = this.videoDetector.getPrimaryBinding();
          if (binding) {
            binding.clearSubtitles();
          }

          // Reset auto-load flags and load new subtitles
          this.hasAutoLoaded = false;
          this.isCurrentlyLoading = false;
          setTimeout(() => this.autoLoadSubtitles(), 1500);
        }
      }, 1000);
    }

    // Netflix episode transition monitoring
    if (this.netflixLoader && this.netflixLoader.isNetflixPage()) {
      // Listen for video metadata changes (episode transitions)
      const monitorNetflixVideo = () => {
        const videoElement = this.netflixLoader.getVideoElement();
        if (videoElement && !videoElement.hasAttribute('data-helios-episode-monitor')) {
          videoElement.setAttribute('data-helios-episode-monitor', 'true');

          videoElement.addEventListener('loadedmetadata', () => {
            console.log('[Helios Video] Netflix episode change detected');

            // Clear old subtitles
            const binding = this.videoDetector.getPrimaryBinding();
            if (binding) {
              binding.clearSubtitles();
            }

            // Reset auto-load flags and reload subtitles
            this.hasAutoLoaded = false;
            this.isCurrentlyLoading = false;

            // Wait longer for Netflix to fully load manifest (especially after navigation)
            console.log('[Helios Video] Waiting 3 seconds for Netflix manifest to load...');
            setTimeout(() => this.autoLoadNetflixSubtitles(), 3000);
          });
        }
      };

      // Monitor for video element changes
      const observer = new MutationObserver(monitorNetflixVideo);
      observer.observe(document.body, { childList: true, subtree: true });

      // Initial check
      monitorNetflixVideo();
    }
  }

  /**
   * Setup listener for language changes to reload subtitles (YouTube and Netflix)
   */
  _setupLanguageChangeListener(): void {
    const isYouTube = this.youtubeLoader && this.youtubeLoader.isYouTubePage();
    const isNetflix = this.netflixLoader && this.netflixLoader.isNetflixPage();

    if (!isYouTube && !isNetflix) return;

    // Listen for language change from the language registry
    if (window.languageRegistry) {
      window.languageRegistry.on('languageChanged', async (newLanguage: string) => {
        // Clear old subtitles
        const binding = this.videoDetector.getPrimaryBinding();
        if (binding) {
          binding.clearSubtitles();
        }

        // Reset auto-load flags and reload subtitles with new language
        this.hasAutoLoaded = false;
        this.isCurrentlyLoading = false;

        // Small delay to ensure dictionary is loaded
        setTimeout(() => {
          if (isYouTube) {
            this.autoLoadSubtitles();
          } else if (isNetflix) {
            this.autoLoadNetflixSubtitles();
          }
        }, 500);
      });
    }
  }

  /**
   * Automatically load subtitles based on target language
   */
  async autoLoadSubtitles(): Promise<void> {
    // Prevent duplicate loading attempts
    if (this.hasAutoLoaded || this.isCurrentlyLoading) {
      return;
    }

    if (!this.youtubeLoader || !this.youtubeLoader.isYouTubePage()) {
      return;
    }

    const binding = this.videoDetector.getPrimaryBinding();
    if (!binding) {
      return;
    }

    this.isCurrentlyLoading = true;

    try {
      // Start loading state (pause video if not ad, show loading indicator)
      binding.startLoadingSubtitles();

      // Get target language from language registry (already loaded and synced)
      let targetLanguage = window.languageRegistry?.getCurrentLanguage() || 'zh';

      // Fallback: if language registry not available, read from storage.
      // NOTE: `targetLanguage` is a `local` key everywhere else in the
      // extension; this reads `sync`, so it always misses and falls through to
      // 'zh'. Preserved as-is — fixing it would change behavior.
      if (!window.languageRegistry) {
        const settings = await browser.storage.sync.get('targetLanguage');
        targetLanguage = (settings.targetLanguage as string | undefined)?.toLowerCase() || 'zh';
      }

      // Get available tracks
      const tracks = await this.youtubeLoader.getAvailableTracks();

      if (tracks.length === 0) {
        binding.finishLoadingSubtitles();
        this.isCurrentlyLoading = false;
        this._showNotification('No subtitles available', 'error');
        // Also notify sidebar to remove loading overlay
        document.dispatchEvent(new CustomEvent('helios-subtitle-load-failed'));
        return;
      }

      // Find matching track (now async to check preferences)
      const matchingTrack = await this._findMatchingTrack(tracks, targetLanguage);

      if (matchingTrack) {
        this.hasAutoLoaded = true;
        await this._loadYouTubeTrack(matchingTrack);
        // Use display name from language code if languageName is just a code (2-3 chars)
        const displayName = (matchingTrack.languageName && matchingTrack.languageName.length > 3)
          ? matchingTrack.languageName
          : this._getLanguageDisplayName(matchingTrack.language || targetLanguage);
        this._showNotification(`Loaded ${displayName} subtitles`, 'success');
      } else {
        binding.finishLoadingSubtitles();
        const languageName = this._getLanguageDisplayName(targetLanguage);
        this._showNotification(`No ${languageName} subtitles available`, 'error');
        // Also notify sidebar to remove loading overlay
        document.dispatchEvent(new CustomEvent('helios-subtitle-load-failed'));
      }
    } catch (error) {
      console.error('[Helios Video] Auto-load failed:', error);
      binding.finishLoadingSubtitles();
      // Also notify sidebar to remove loading overlay
      document.dispatchEvent(new CustomEvent('helios-subtitle-load-failed'));
    } finally {
      this.isCurrentlyLoading = false;
    }
  }

  /**
   * Automatically load Netflix subtitles (works exactly like YouTube)
   */
  async autoLoadNetflixSubtitles(): Promise<void> {
    // Prevent duplicate loading attempts
    if (this.hasAutoLoaded || this.isCurrentlyLoading) {
      return;
    }

    if (!this.netflixLoader || !this.netflixLoader.isNetflixPage()) {
      return;
    }

    // Wait for video to be ready
    if (!this.netflixLoader.isWatchingVideo()) {
      // Retry in 1 second
      setTimeout(() => this.autoLoadNetflixSubtitles(), 1000);
      return;
    }

    const binding = this.videoDetector.getPrimaryBinding();
    if (!binding) {
      // Retry in 1 second if binding not ready
      setTimeout(() => this.autoLoadNetflixSubtitles(), 1000);
      return;
    }

    this.isCurrentlyLoading = true;

    try {
      // Start loading state (pause video if not ad, show loading indicator)
      binding.startLoadingSubtitles();

      // Get target language from language registry (same as YouTube)
      let targetLanguage = window.languageRegistry?.getCurrentLanguage() || 'zh';

      // Fallback: if language registry not available, read from storage.
      // NOTE: reads `sync` while `targetLanguage` lives in `local` — see the
      // matching note in autoLoadSubtitles().
      if (!window.languageRegistry) {
        const settings = await browser.storage.sync.get('targetLanguage');
        targetLanguage = (settings.targetLanguage as string | undefined)?.toLowerCase() || 'zh';
      }

      // Get available tracks (with retry for Netflix navigation)
      let tracks = await this.netflixLoader.getAvailableTracks();

      // If no tracks, retry a few times (tracks might not be ready after navigation)
      if (tracks.length === 0) {
        console.log('[Helios Video] No tracks yet, retrying in 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        tracks = await this.netflixLoader.getAvailableTracks();
      }

      if (tracks.length === 0) {
        console.log('[Helios Video] Still no tracks, retrying one more time...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        tracks = await this.netflixLoader.getAvailableTracks();
      }

      if (tracks.length === 0) {
        binding.finishLoadingSubtitles();
        this.isCurrentlyLoading = false;
        this._showNotification('No subtitles available', 'error');
        return;
      }

      // Find matching track (uses same logic as YouTube)
      const matchingTrack = await this._findMatchingTrack(tracks, targetLanguage);

      if (matchingTrack) {
        this.hasAutoLoaded = true;
        await this._loadNetflixTrack(matchingTrack);
        // Use display name from language code if languageName is just a code (2-3 chars)
        const displayName = (matchingTrack.languageName && matchingTrack.languageName.length > 3)
          ? matchingTrack.languageName
          : this._getLanguageDisplayName(matchingTrack.language || targetLanguage);
        this._showNotification(`Loaded ${displayName} subtitles`, 'success');
      } else {
        binding.finishLoadingSubtitles();
        const languageName = this._getLanguageDisplayName(targetLanguage);
        this._showNotification(`No ${languageName} subtitles available`, 'error');
      }
    } catch (error) {
      console.error('[Helios Video] Netflix auto-load failed:', error);
      binding.finishLoadingSubtitles();
      this._showNotification('Failed to load subtitles', 'error');
    } finally {
      this.isCurrentlyLoading = false;
    }
  }

  /**
   * Find best matching track for target language
   * Checks saved preferences first, then falls back to default matching
   */
  async _findMatchingTrack(tracks: any[], targetLanguage: string): Promise<any | null> {
    // PRIORITY 1: Check for per-video preference
    const videoId = this._getCurrentVideoId();
    if (videoId) {
      try {
        const preferences = await items.subtitlePreferences.getValue();
        const perVideoPref = preferences?.perVideo?.[videoId];

        if (perVideoPref) {
          const preferredTrack = tracks.find(t =>
            t.language === perVideoPref.language &&
            (t.isAutoGenerated || false) === perVideoPref.isAutoGenerated
          );
          if (preferredTrack) {
            return preferredTrack;
          }
        }
      } catch (error) {
        console.error('[Helios Video] Error loading per-video preference:', error);
      }
    }

    // PRIORITY 2: Check for global language variant preference
    try {
      const preferences = await items.subtitlePreferences.getValue();
      const globalPref = preferences?.global?.[targetLanguage];

      if (globalPref) {
        const preferredTrack = tracks.find(t =>
          t.language === globalPref && !t.isAutoGenerated
        );
        if (preferredTrack) {
          return preferredTrack;
        }
      }
    } catch (error) {
      console.error('[Helios Video] Error loading global preference:', error);
    }

    // PRIORITY 3: Fall back to default matching logic
    const possibleCodes = this.languageMap[targetLanguage] || [];

    // First try: exact match (prefer manual over auto-generated)
    for (const code of possibleCodes) {
      const track = tracks.find(t =>
        t.language === code && !t.isAutoGenerated
      );
      if (track) return track;
    }

    // Second try: exact match (including auto-generated)
    for (const code of possibleCodes) {
      const track = tracks.find(t => t.language === code);
      if (track) return track;
    }

    // Third try: partial match (e.g., "zh" matches "zh-Hans")
    for (const code of possibleCodes) {
      const track = tracks.find(t =>
        t.language.startsWith(code) || code.startsWith(t.language)
      );
      if (track) return track;
    }

    return null;
  }

  /**
   * Get current video ID from URL
   */
  _getCurrentVideoId(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  /**
   * Get display name for language code
   */
  _getLanguageDisplayName(code: string): string {
    const languageNames: Record<string, string> = {
      'chinese': 'Chinese',
      'zh': 'Chinese',
      'japanese': 'Japanese',
      'ja': 'Japanese',
      'korean': 'Korean',
      'ko': 'Korean',
      'spanish': 'Spanish',
      'es': 'Spanish',
      'french': 'French',
      'fr': 'French',
      'german': 'German',
      'de': 'German',
      'italian': 'Italian',
      'it': 'Italian',
      'portuguese': 'Portuguese',
      'pt': 'Portuguese',
      'russian': 'Russian',
      'ru': 'Russian',
      'arabic': 'Arabic',
      'ar': 'Arabic',
      'hindi': 'Hindi',
      'hi': 'Hindi',
      'english': 'English',
      'en': 'English'
    };
    return languageNames[code.toLowerCase()] || code;
  }

  /**
   * Show notification to user (dispatches event for sidebar to handle)
   */
  _showNotification(message: string, type: string = 'info'): void {
    // Dispatch event for YouTube sidebar to show notification
    document.dispatchEvent(new CustomEvent('helios-video-notification', {
      detail: { message, type }
    }));
  }

  /**
   * Load YouTube subtitle track
   */
  async _loadYouTubeTrack(track: any): Promise<void> {
    try {
      const entries = await this.youtubeLoader.loadTrack(track.url);
      const binding = this.videoDetector.getPrimaryBinding();

      if (binding && entries.length > 0) {
        // loadSubtitles() will dispatch 'helios-subtitles-loaded' event automatically
        binding.loadSubtitles(entries, track);
        console.log(`[Helios Video] ✅ Loaded ${entries.length} subtitles (${track.languageName})`);
      }
    } catch (error) {
      console.error('[Helios Video] Failed to load YouTube track:', error);
    }
  }

  /**
   * Load Netflix subtitle track
   */
  async _loadNetflixTrack(track: any): Promise<void> {
    try {
      const entries = await this.netflixLoader.loadTrack(track);
      const binding = this.videoDetector.getPrimaryBinding();

      if (binding && entries.length > 0) {
        // loadSubtitles() will dispatch 'helios-subtitles-loaded' event automatically
        binding.loadSubtitles(entries, track);
        console.log(`[Helios Video] ✅ Loaded ${entries.length} subtitles (${track.languageName})`);
      }
    } catch (error) {
      console.error('[Helios Video] Failed to load Netflix track:', error);
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  async _setupKeyboardShortcuts(): Promise<void> {
    // Load shortcut configuration
    const shortcuts = await ShortcutHelper.getVideoShortcuts();
    const panelShortcut = shortcuts.togglePanel;
    const youtubeShortcut = shortcuts.loadYouTube;

    // Remove existing listener if any
    if (this._keyboardListener) {
      document.removeEventListener('keydown', this._keyboardListener);
    }

    // Create new listener with current shortcut config
    this._keyboardListener = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Toggle subtitle panel
      if (ShortcutHelper.matchesVideoShortcut(e, panelShortcut)) {
        e.preventDefault();
        this._toggleSubtitlePanel();
        return;
      }

      // Auto-load subtitles (YouTube or Netflix)
      if (ShortcutHelper.matchesVideoShortcut(e, youtubeShortcut)) {
        e.preventDefault();
        this.hasAutoLoaded = false;

        // Check which platform we're on and call appropriate method
        if (this.youtubeLoader && this.youtubeLoader.isYouTubePage()) {
          this.autoLoadSubtitles();
        } else if (this.netflixLoader && this.netflixLoader.isNetflixPage()) {
          this.autoLoadNetflixSubtitles();
        }
        return;
      }
    };

    document.addEventListener('keydown', this._keyboardListener);
  }

  /**
   * Toggle subtitle panel
   */
  _toggleSubtitlePanel(): void {
    const event = new CustomEvent('helios-toggle-subtitle-panel');
    document.dispatchEvent(event);
  }

  /**
   * Destroy UI controller
   */
  destroy(): void {
    this.isInitialized = false;
  }
}
