/**
 * Helios YouTube Sidebar Controller
 * Manages the YouTube-specific sidebar with subtitle list
 */
class YouTubeSidebar {
  constructor() {
    this.sidebar = null;
    this.listContainer = null;
    this.currentSubtitles = [];
    this.currentTrack = null;
    this.videoBinding = null;
    this.isVisible = false;
    this.activeIndex = -1;

    if (this.isYouTubePage()) {
      this._init();
    }
  }

  /**
   * Check if current page is YouTube
   */
  isYouTubePage() {
    return window.location.hostname.includes('youtube.com') ||
           window.location.hostname.includes('youtu.be');
  }

  /**
   * Initialize sidebar
   */
  async _init() {
    await this._loadSidebar();
    this._setupEventListeners();
    this._enableTheaterMode();
    this._adjustVideoLayout();
  }

  /**
   * Load sidebar HTML
   */
  async _loadSidebar() {
    try {
      const response = await fetch(chrome.runtime.getURL('src/ui/youtube-sidebar/youtube-sidebar.html'));
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      this.sidebar = doc.querySelector('.helios-youtube-sidebar');

      // Inject CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('src/ui/youtube-sidebar/youtube-sidebar.css');
      document.head.appendChild(link);

      // Add to page
      document.body.appendChild(this.sidebar);

      // Get elements
      this.listContainer = this.sidebar.querySelector('#yt-subtitle-list');
      this.countElement = this.sidebar.querySelector('#yt-subtitle-count');

      this.isVisible = true;
      console.log('[Helios YouTube Sidebar] Initialized');
    } catch (error) {
      console.error('[Helios YouTube Sidebar] Failed to load:', error);
    }
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Listen for subtitles being loaded
    document.addEventListener('helios-subtitles-loaded', (e) => {
      const { track, entries } = e.detail;
      this.updateSubtitles(entries, track);
    });

    // Listen for time updates to highlight current subtitle
    document.addEventListener('helios-video-timeupdate', (e) => {
      const { currentTime, binding } = e.detail;
      this.videoBinding = binding;
      this._updateActiveSubtitle(currentTime);
    });

    // Toggle sidebar visibility
    document.addEventListener('helios-toggle-subtitle-panel', () => {
      this.toggle();
    });
  }

  /**
   * Enable YouTube theater mode
   */
  _enableTheaterMode() {
    // Wait for YouTube to be ready
    setTimeout(() => {
      const ytdWatchFlexy = document.querySelector('ytd-watch-flexy');
      if (ytdWatchFlexy && !ytdWatchFlexy.hasAttribute('theater')) {
        // Click the theater mode button
        const theaterButton = document.querySelector('button.ytp-size-button');
        if (theaterButton) {
          theaterButton.click();
          console.log('[Helios YouTube Sidebar] Enabled theater mode');
        }
      }
    }, 1000);
  }

  /**
   * Adjust video layout to accommodate sidebar
   */
  _adjustVideoLayout() {
    // Wait for page-manager to exist (YouTube uses dynamic loading)
    const checkAndAdjust = () => {
      const pageManager = document.querySelector('#page-manager');
      if (pageManager) {
        pageManager.classList.add('helios-sidebar-active');
        pageManager.classList.remove('helios-sidebar-hidden');
        console.log('[Helios YouTube Sidebar] Video layout adjusted');
      } else {
        // Retry after a short delay
        setTimeout(checkAndAdjust, 100);
      }
    };
    checkAndAdjust();
  }

  /**
   * Update subtitles in sidebar
   */
  updateSubtitles(entries, track) {
    this.currentSubtitles = entries;
    this.currentTrack = track;

    // Update count
    if (this.countElement) {
      this.countElement.textContent = entries.length.toString();
    }

    // Render subtitle list
    this._renderSubtitleList();
  }

  /**
   * Render subtitle list
   */
  _renderSubtitleList() {
    if (!this.listContainer) return;

    // Clear existing
    this.listContainer.innerHTML = '';

    if (this.currentSubtitles.length === 0) {
      this.listContainer.innerHTML = `
        <div class="yt-subtitle-empty">
          <div class="empty-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <line x1="9" y1="9" x2="15" y2="9"></line>
              <line x1="9" y1="13" x2="15" y2="13"></line>
            </svg>
          </div>
          <p>Subtitles will appear here</p>
          <small>Auto-loads based on your target language</small>
        </div>
      `;
      return;
    }

    // Create subtitle items
    this.currentSubtitles.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'yt-subtitle-item';
      item.dataset.index = index;

      const timestamp = document.createElement('div');
      timestamp.className = 'yt-subtitle-timestamp';
      timestamp.textContent = this._formatTime(entry.start);

      const text = document.createElement('div');
      text.className = 'yt-subtitle-text';
      text.textContent = entry.text;

      item.appendChild(timestamp);
      item.appendChild(text);

      // Click to seek
      item.addEventListener('click', () => {
        this._seekToSubtitle(entry);
      });

      this.listContainer.appendChild(item);
    });
  }

  /**
   * Update active subtitle highlight
   */
  _updateActiveSubtitle(currentTime) {
    if (!this.listContainer || this.currentSubtitles.length === 0) return;

    // Find active subtitle
    const activeEntry = this.currentSubtitles.find(entry =>
      currentTime >= entry.start && currentTime <= entry.end
    );

    if (!activeEntry) {
      // Clear active state
      if (this.activeIndex !== -1) {
        const prevActive = this.listContainer.querySelector('.yt-subtitle-item.active');
        if (prevActive) {
          prevActive.classList.remove('active');
        }
        this.activeIndex = -1;
      }
      return;
    }

    const newIndex = this.currentSubtitles.indexOf(activeEntry);
    if (newIndex === this.activeIndex) return;

    // Update active state
    this.activeIndex = newIndex;

    const items = this.listContainer.querySelectorAll('.yt-subtitle-item');
    items.forEach((item, index) => {
      if (index === newIndex) {
        item.classList.add('active');
        // Scroll into view
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Seek to subtitle
   */
  _seekToSubtitle(entry) {
    if (this.videoBinding) {
      this.videoBinding.seekTo(entry.start);
    }
  }

  /**
   * Format time in MM:SS format
   */
  _formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Expand to full Helios sidebar
   */
  _expandHelios() {
    // Dispatch event to open main sidebar
    document.dispatchEvent(new CustomEvent('helios-open-sidebar'));
  }

  /**
   * Show sidebar
   */
  show() {
    if (this.sidebar) {
      this.sidebar.classList.remove('hidden');
      this.isVisible = true;

      // Adjust video layout
      const pageManager = document.querySelector('#page-manager');
      if (pageManager) {
        pageManager.classList.add('helios-sidebar-active');
        pageManager.classList.remove('helios-sidebar-hidden');
      }
    }
  }

  /**
   * Hide sidebar
   */
  hide() {
    if (this.sidebar) {
      this.sidebar.classList.add('hidden');
      this.isVisible = false;

      // Remove video layout adjustment
      const pageManager = document.querySelector('#page-manager');
      if (pageManager) {
        pageManager.classList.add('helios-sidebar-hidden');
      }
    }
  }

  /**
   * Toggle sidebar visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Destroy sidebar
   */
  destroy() {
    if (this.sidebar && this.sidebar.parentElement) {
      this.sidebar.parentElement.removeChild(this.sidebar);
    }
    this.sidebar = null;

    // Remove video layout adjustment
    const pageManager = document.querySelector('#page-manager');
    if (pageManager) {
      pageManager.classList.remove('helios-sidebar-active');
      pageManager.classList.remove('helios-sidebar-hidden');
    }
  }
}
