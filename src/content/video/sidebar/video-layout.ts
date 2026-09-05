import { VideoConstants } from '@/content/video/config/video-constants';

/**
 * Page-layout manipulation for the platform video sidebar.
 *
 * Everything here works on the host page's own elements — the streaming
 * platform's player container, its controls, the fullscreen element — plus the
 * sidebar element it is handed. None of it reads or writes sidebar state, so
 * the caller keeps ownership of flags like `isVisible`.
 */

/**
 * Apply platform-specific positioning (fixed right side, full height).
 * Leaves the sidebar hidden; the caller decides when to show it.
 */
export function applyPlatformPositioning(sidebar: HTMLElement): void {
  // Fixed position on right side
  sidebar.style.setProperty('position', 'fixed', 'important');
  sidebar.style.setProperty('right', '0', 'important');
  sidebar.style.setProperty('top', '0', 'important');
  sidebar.style.setProperty('height', '100vh', 'important');
  sidebar.style.setProperty('z-index', VideoConstants.Z_INDEX.SIDEBAR.toString(), 'important');
  sidebar.style.setProperty('width', `${VideoConstants.SIDEBAR_WIDTH}px`, 'important');

  // Start hidden - will be shown by init() if on watch page
  sidebar.style.setProperty('display', 'none', 'important');
  sidebar.style.setProperty('visibility', 'hidden', 'important');
  sidebar.style.setProperty('opacity', '0', 'important');
}

/**
 * Adjust video layout to push video left and make room for sidebar
 */
export function adjustVideoLayout(): void {
  try {
    const hostname = window.location.hostname.toLowerCase();
    const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement);

    if (isFullscreen) {
    // In fullscreen, adjust the fullscreen container to make room for sidebar
    const fullscreenEl = (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement) as HTMLElement | null;

    if (fullscreenEl) {
      // Set the fullscreen container to relative positioning so absolute children work correctly
      fullscreenEl.style.setProperty('position', 'relative', 'important');
      fullscreenEl.style.setProperty('width', '100vw', 'important');
      fullscreenEl.style.setProperty('height', '100vh', 'important');
      fullscreenEl.style.setProperty('overflow', 'hidden', 'important');
      fullscreenEl.style.setProperty('margin', '0', 'important');
      fullscreenEl.style.setProperty('padding', '0', 'important');
    }

    // Platform-specific adjustments
    if (hostname.includes('netflix.com')) {
      // Adjust Netflix's video container - this is the key element that needs to be sized
      const videoContainer = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.PLAYER) ||
                            document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.PLAYER_VIEW) ||
                            document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.VIDEO_CONTAINER);

      if (videoContainer) {
        const adjustedWidth = `calc(100vw - ${VideoConstants.SIDEBAR_WIDTH}px)`;
        videoContainer.style.setProperty('width', adjustedWidth, 'important');
        videoContainer.style.setProperty('max-width', adjustedWidth, 'important');
        videoContainer.style.setProperty('min-width', adjustedWidth, 'important');
        videoContainer.style.setProperty('height', '100vh', 'important');
        videoContainer.style.setProperty('max-height', '100vh', 'important');
        videoContainer.style.setProperty('position', 'absolute', 'important');
        videoContainer.style.setProperty('left', '0', 'important');
        videoContainer.style.setProperty('top', '0', 'important');
        videoContainer.style.setProperty('margin', '0', 'important');
        videoContainer.style.setProperty('padding', '0', 'important');
      }

      // Find and adjust the video element itself
      const video = document.querySelector<HTMLVideoElement>('video');
      if (video) {
        video.style.setProperty('width', '100%', 'important');
        video.style.setProperty('height', '100%', 'important');
        video.style.setProperty('max-width', '100%', 'important');
        video.style.setProperty('max-height', '100%', 'important');
        video.style.setProperty('object-fit', 'contain', 'important');
        video.style.setProperty('margin', '0', 'important');
        video.style.setProperty('padding', '0', 'important');
      }

      // Adjust Netflix's controls overlay
      const controlsOverlay = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS_LAYOUT);
      if (controlsOverlay) {
        const adjustedWidth = `calc(100vw - ${VideoConstants.SIDEBAR_WIDTH}px)`;
        controlsOverlay.style.setProperty('width', adjustedWidth, 'important');
        controlsOverlay.style.setProperty('max-width', adjustedWidth, 'important');
      }

      // Adjust Netflix's controls container (bottom bar with play/pause, etc.)
      const controls = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS);
      if (controls) {
        const adjustedWidth = `calc(100vw - ${VideoConstants.SIDEBAR_WIDTH}px)`;
        controls.style.setProperty('width', adjustedWidth, 'important');
        controls.style.setProperty('max-width', adjustedWidth, 'important');
      }

      // Adjust Netflix subtitles in fullscreen
      const timedText = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.SUBTITLES);
      if (timedText) {
        timedText.style.setProperty('max-width', `calc(100vw - ${VideoConstants.SIDEBAR_WIDTH}px)`, 'important');
        timedText.style.setProperty('left', '0', 'important');
      }

      // Hide Netflix's native subtitle panel if it exists
      const nativeSubtitlePanel = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.SUBTITLE_PANEL);
      if (nativeSubtitlePanel) {
        nativeSubtitlePanel.style.setProperty('display', 'none', 'important');
      }
    }
  } else {
    // Normal mode - find the video container based on platform
    let videoContainer: HTMLElement | null = null;

    if (hostname.includes('netflix.com')) {
      videoContainer = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.VIDEO_CONTAINER) ||
                      document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.PLAYER) ||
                      document.querySelector<HTMLElement>('[data-uia="watch-video"]');
      document.body.style.overflowX = 'hidden';
    } else if (hostname.includes('disneyplus.com')) {
      videoContainer = document.querySelector<HTMLElement>('.btm-media-player-root') ||
                      document.querySelector<HTMLElement>('[data-testid="media-player-container"]');
    } else if (hostname.includes('amazon.') || hostname.includes('primevideo.com')) {
      videoContainer = document.querySelector<HTMLElement>('.dv-player-fullscreen') ||
                      document.querySelector<HTMLElement>('[data-testid="player-container"]') ||
                      document.querySelector<HTMLElement>('.cascadesContainer');
    }

    if (videoContainer) {
      const adjustedWidth = `calc(100% - ${VideoConstants.SIDEBAR_WIDTH}px)`;
      const adjustedMaxWidth = `calc(100vw - ${VideoConstants.SIDEBAR_WIDTH}px)`;
      videoContainer.style.setProperty('width', adjustedWidth, 'important');
      videoContainer.style.setProperty('max-width', adjustedMaxWidth, 'important');
      videoContainer.style.transition = 'width 0.2s ease, max-width 0.2s ease';

      if (hostname.includes('netflix.com')) {
        // Ensure video element scales properly within the container
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video) {
          video.style.setProperty('width', '100%', 'important');
          video.style.setProperty('height', '100%', 'important');
          video.style.setProperty('object-fit', 'contain', 'important');
        }

        // Adjust Netflix subtitles
        const timedText = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.SUBTITLES);
        if (timedText) {
          timedText.style.setProperty('max-width', adjustedMaxWidth, 'important');
        }

        // Ensure controls are properly sized
        const controlsOverlay = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS_LAYOUT);
        if (controlsOverlay) {
          controlsOverlay.style.setProperty('width', adjustedMaxWidth, 'important');
          controlsOverlay.style.setProperty('max-width', adjustedMaxWidth, 'important');
        }

        const controls = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS);
        if (controls) {
          controls.style.setProperty('width', adjustedMaxWidth, 'important');
          controls.style.setProperty('max-width', adjustedMaxWidth, 'important');
        }
      }
    } else {
      setTimeout(() => adjustVideoLayout(), VideoConstants.TIMING.LAYOUT_RETRY);
    }
    }

  // Force Netflix to recalculate layout
  if (hostname.includes('netflix.com')) {
    // Trigger a window resize event to force Netflix to recalculate
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }
  } catch (error) {
    console.error('[Helios Platform Sidebar] Error adjusting video layout:', error);
  }
}

/**
 * Reset fullscreen styles when exiting fullscreen
 */
export function resetFullscreenStyles(): void {
  try {
    const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('netflix.com')) {
    // Reset Netflix video container
    const videoContainer = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.PLAYER) ||
                          document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.PLAYER_VIEW) ||
                          document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.VIDEO_CONTAINER);

    if (videoContainer) {
      videoContainer.style.removeProperty('width');
      videoContainer.style.removeProperty('max-width');
      videoContainer.style.removeProperty('min-width');
      videoContainer.style.removeProperty('height');
      videoContainer.style.removeProperty('max-height');
      videoContainer.style.removeProperty('position');
      videoContainer.style.removeProperty('left');
      videoContainer.style.removeProperty('top');
      videoContainer.style.removeProperty('margin');
      videoContainer.style.removeProperty('padding');
    }

    // Reset video element
    const video = document.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.style.removeProperty('width');
      video.style.removeProperty('height');
      video.style.removeProperty('max-width');
      video.style.removeProperty('max-height');
      video.style.removeProperty('margin');
      video.style.removeProperty('padding');
    }

    // Reset controls
    const controlsOverlay = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS_LAYOUT);
    if (controlsOverlay) {
      controlsOverlay.style.removeProperty('width');
      controlsOverlay.style.removeProperty('max-width');
    }

    const controls = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS);
    if (controls) {
      controls.style.removeProperty('width');
      controls.style.removeProperty('max-width');
    }

    // Reset subtitles
    const timedText = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.SUBTITLES);
    if (timedText) {
      timedText.style.removeProperty('max-width');
      timedText.style.removeProperty('left');
    }

    // Show native subtitle panel again
    const nativeSubtitlePanel = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.SUBTITLE_PANEL);
    if (nativeSubtitlePanel) {
      nativeSubtitlePanel.style.removeProperty('display');
    }
  }
  } catch (error) {
    console.error('[Helios Platform Sidebar] Error resetting fullscreen styles:', error);
  }
}

/**
 * Position the sidebar against the viewport. Same rules in and out of
 * fullscreen apart from the stacking order — Netflix has its own page layout,
 * so the sidebar uses 100vh rather than matching the video's height.
 */
export function syncSidebarPosition(sidebar: HTMLElement, isFullscreen: boolean): void {
  // In fullscreen, use fixed positioning to fill viewport
  if (isFullscreen) {
    sidebar.style.setProperty('height', '100vh', 'important');
    sidebar.style.setProperty('top', '0', 'important');
    sidebar.style.setProperty('position', 'fixed', 'important');
    sidebar.style.setProperty('right', '0', 'important');
  } else {
    // Normal mode - always use full viewport height and position at top
    // Netflix has its own page layout, so we use 100vh instead of matching video height
    sidebar.style.setProperty('height', '100vh', 'important');
    sidebar.style.setProperty('top', '0', 'important');
    sidebar.style.setProperty('position', 'fixed', 'important');
    sidebar.style.setProperty('right', '0', 'important');
  }

  // Ensure sidebar is always visible in fullscreen
  if (isFullscreen) {
    sidebar.style.setProperty('z-index', VideoConstants.Z_INDEX.SIDEBAR_FULLSCREEN.toString(), 'important');
  } else {
    sidebar.style.setProperty('z-index', VideoConstants.Z_INDEX.SIDEBAR.toString(), 'important');
  }
}

/**
 * Remove video layout adjustment when hiding sidebar
 */
export function removeVideoLayoutAdjustment(): void {
  const hostname = window.location.hostname.toLowerCase();
  const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement);

  console.log('[Helios Platform Sidebar] Restoring video layout, fullscreen:', isFullscreen);

  // Always reset Netflix elements (both fullscreen and normal mode)
  if (hostname.includes('netflix.com')) {
    // Reset all Netflix containers
    const videoContainer = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.VIDEO_CONTAINER);
    const player = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.PLAYER);
    const playerView = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.PLAYER_VIEW);

    if (videoContainer) {
      videoContainer.style.removeProperty('width');
      videoContainer.style.removeProperty('max-width');
      videoContainer.style.removeProperty('min-width');
      videoContainer.style.removeProperty('height');
      videoContainer.style.removeProperty('max-height');
      videoContainer.style.removeProperty('position');
      videoContainer.style.removeProperty('left');
      videoContainer.style.removeProperty('top');
      videoContainer.style.removeProperty('margin');
      videoContainer.style.removeProperty('padding');
      videoContainer.style.removeProperty('transition');
    }

    if (player) {
      player.style.removeProperty('width');
      player.style.removeProperty('max-width');
      player.style.removeProperty('min-width');
      player.style.removeProperty('height');
      player.style.removeProperty('max-height');
      player.style.removeProperty('position');
      player.style.removeProperty('left');
      player.style.removeProperty('top');
      player.style.removeProperty('margin');
      player.style.removeProperty('padding');
    }

    if (playerView) {
      playerView.style.removeProperty('width');
      playerView.style.removeProperty('max-width');
      playerView.style.removeProperty('min-width');
    }

    // Reset video element
    const video = document.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.style.removeProperty('width');
      video.style.removeProperty('height');
      video.style.removeProperty('max-width');
      video.style.removeProperty('max-height');
      video.style.removeProperty('object-fit');
      video.style.removeProperty('margin');
      video.style.removeProperty('padding');
      video.style.removeProperty('margin-left');
      video.style.removeProperty('margin-right');
    }

    // Reset Netflix controls
    const controlsOverlay = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS_LAYOUT);
    if (controlsOverlay) {
      controlsOverlay.style.removeProperty('width');
      controlsOverlay.style.removeProperty('max-width');
    }

    const controls = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.CONTROLS);
    if (controls) {
      controls.style.removeProperty('width');
      controls.style.removeProperty('max-width');
    }

    // Reset subtitles
    const timedText = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.SUBTITLES);
    if (timedText) {
      timedText.style.removeProperty('max-width');
      timedText.style.removeProperty('left');
    }

    // Show native subtitle panel again
    const nativeSubtitlePanel = document.querySelector<HTMLElement>(VideoConstants.SELECTORS.NETFLIX.SUBTITLE_PANEL);
    if (nativeSubtitlePanel) {
      nativeSubtitlePanel.style.removeProperty('display');
    }

    // Reset body overflow
    document.body.style.removeProperty('overflow-x');
  } else if (hostname.includes('disneyplus.com')) {
    const videoContainer = document.querySelector<HTMLElement>('.btm-media-player-root') ||
                          document.querySelector<HTMLElement>('[data-testid="media-player-container"]');
    if (videoContainer) {
      videoContainer.style.removeProperty('width');
      videoContainer.style.removeProperty('max-width');
      videoContainer.style.removeProperty('transition');
    }
  } else if (hostname.includes('amazon.') || hostname.includes('primevideo.com')) {
    const videoContainer = document.querySelector<HTMLElement>('.dv-player-fullscreen') ||
                          document.querySelector<HTMLElement>('[data-testid="player-container"]') ||
                          document.querySelector<HTMLElement>('.cascadesContainer');
    if (videoContainer) {
      videoContainer.style.removeProperty('width');
      videoContainer.style.removeProperty('max-width');
      videoContainer.style.removeProperty('transition');
    }
  }

  // Reset fullscreen element if in fullscreen
  if (isFullscreen) {
    const fullscreenEl = (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement) as HTMLElement | null;
    if (fullscreenEl) {
      fullscreenEl.style.removeProperty('position');
      fullscreenEl.style.removeProperty('width');
      fullscreenEl.style.removeProperty('height');
      fullscreenEl.style.removeProperty('overflow');
      fullscreenEl.style.removeProperty('margin');
      fullscreenEl.style.removeProperty('padding');
      fullscreenEl.style.removeProperty('padding-right');
    }
  }

  // Force Netflix to recalculate layout after restoration
  if (hostname.includes('netflix.com')) {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  console.log('[Helios Platform Sidebar] Video layout restored to normal');
}
