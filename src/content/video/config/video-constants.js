/**
 * Video Feature Constants
 * Centralized configuration for video player integration
 */

const VideoConstants = {
  // Sidebar dimensions
  SIDEBAR_WIDTH: 420, // px

  // Z-index values
  Z_INDEX: {
    SIDEBAR: 2147483646,
    SIDEBAR_FULLSCREEN: 2147483647,
    OVERLAY: 2147483647
  },

  // Timing constants (milliseconds)
  TIMING: {
    NAVIGATION_POLL: 250,           // How often to check for SPA navigation
    NAVIGATION_DELAY: 300,          // Delay before showing sidebar on navigation
    LAYOUT_RETRY: 100,              // Retry interval for finding video containers
    FULLSCREEN_ENFORCE: 100,        // How often to re-apply fullscreen layout (Netflix fights back)
    RESIZE_DEBOUNCE: 16,            // Debounce for resize events (~60fps)
    SCROLL_RESET: 2000,             // Time before considering scroll finished
    AUTO_SCROLL_DURATION: 600,      // Duration of auto-scroll animation
    PAUSE_RESUME_DELAY: 300,        // Delay before resuming video after hover
    HOTKEY_JUMP_DELAY: 50,          // Delay for hotkey jump flag
    PAUSE_AT_END_THRESHOLD: 150     // Milliseconds before subtitle end to pause
  },

  // Platform-specific selectors
  SELECTORS: {
    NETFLIX: {
      VIDEO_CONTAINER: '.watch-video',
      PLAYER: '.NFPlayer',
      PLAYER_VIEW: '.watch-video--player-view',
      CONTROLS_LAYOUT: '.PlayerControlsNeo__layout',
      CONTROLS: '.PlayerControlsNeo__all-controls',
      SUBTITLES: '.player-timedtext-text-container',
      SUBTITLE_PANEL: '.watch-video--audio-subtitle-controller'
    },
    YOUTUBE: {
      PRIMARY: '#primary',
      WATCH_FLEXY: 'ytd-watch-flexy',
      PLAYER: '#movie_player',
      VIDEO_CONTAINER: '.html5-video-container'
    }
  },

  // Platform-specific paths
  PATHS: {
    NETFLIX_WATCH: '/watch',
    YOUTUBE_WATCH: '/watch',
    DISNEY_WATCH: ['/video', '/play'],
    PRIME_WATCH: ['/detail', '/player']
  }
};

// Make constants globally available
if (typeof window !== 'undefined') {
  window.VideoConstants = VideoConstants;
}
