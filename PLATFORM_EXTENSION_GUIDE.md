# Platform Extension Guide

## Architecture Overview

The Helios YouTube video player integration has been designed with a **modular, platform-agnostic architecture** that makes it easy to extend to other video platforms (Netflix, Coursera, etc.).

## Core Principles

1. **Separation of Concerns**: Each component has a single, well-defined responsibility
2. **Platform-Specific Modules**: Platform-specific code is isolated in dedicated directories
3. **Reusable Components**: Core video functionality is shared across all platforms
4. **Clean Interfaces**: Components communicate through clear, documented APIs

## Directory Structure

```
src/content/video/
├── core/                       # Platform-agnostic core functionality
│   ├── video-binding.js       # Generic video element binding
│   └── video-detector.js      # Detects video elements on any page
├── models/                     # Shared data models
│   ├── subtitle-entry.js
│   └── subtitle-collection.js
├── parsers/                    # Subtitle format parsers (SRT, VTT, etc.)
├── loaders/                    # Subtitle loading logic
├── controllers/                # Shared controllers
├── youtube/                    # YouTube-specific modules ⭐
│   ├── theater-mode-controller.js
│   ├── layout-manager.js
│   └── sidebar-positioner.js
└── [future-platform]/          # Add new platforms here
    ├── platform-mode-controller.js
    ├── layout-manager.js
    └── sidebar-positioner.js
```

## How to Add a New Platform (e.g., Netflix)

### Step 1: Create Platform Directory

Create a new directory for your platform:
```
src/content/video/netflix/
```

### Step 2: Implement Platform-Specific Controllers

Based on the YouTube implementation, create analogous controllers for your platform:

#### 2.1 Mode Controller (e.g., `fullscreen-mode-controller.js`)

**Purpose**: Manage the platform's optimal viewing mode for the sidebar

**YouTube Example**: `theater-mode-controller.js` manages YouTube's theater mode

**What to implement**:
```javascript
class NetflixFullscreenModeController {
  constructor() {
    this.isFullscreen = false;
  }

  isActive() {
    // Check if Netflix is in fullscreen mode
  }

  async enable() {
    // Trigger Netflix fullscreen mode
  }

  async disable() {
    // Exit Netflix fullscreen mode
  }

  observeModeChanges() {
    // Watch for user toggling fullscreen
  }

  cleanup() {
    // Disconnect observers
  }
}
```

**Key Questions**:
- What viewing mode works best with a sidebar? (Theater, fullscreen, etc.)
- How do you detect this mode? (DOM attribute, class, CSS property?)
- How do you programmatically trigger this mode? (Button click, API call?)

#### 2.2 Layout Manager (e.g., `netflix-layout-manager.js`)

**Purpose**: Adjust the page layout to make room for the sidebar

**YouTube Example**: `layout-manager.js` constrains video width to push it left

**What to implement**:
```javascript
class NetflixLayoutManager {
  constructor() {
    this.isActive = false;
    this.sidebarWidth = 420;
    this.observers = [];
  }

  activate() {
    // Add CSS class to body: 'helios-sidebar-active'
    // This triggers CSS rules that adjust layout
    document.body.classList.add('helios-sidebar-active');

    // Force video player to recalculate
    this._triggerVideoResize();

    // Setup observers to maintain layout
    this._setupLayoutMaintenanceObserver();
  }

  deactivate() {
    // Remove CSS class
    document.body.classList.remove('helios-sidebar-active');

    // Clear all inline styles
    this._cleanupInlineStyles();

    // Force platform to reset layout
    this._forcePlatformLayoutRefresh();
  }

  getVideoPlayerContainer() {
    // Return the video player element
    return document.querySelector('.netflix-video-player');
  }

  _triggerVideoResize() {
    // Dispatch resize event or platform-specific trigger
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  cleanup() {
    this.deactivate();
  }
}
```

**Key Questions**:
- What DOM elements control the video player layout?
- How can you constrain the video width? (CSS max-width, transform, etc.)
- Does the platform fight back with JavaScript? (Use MutationObserver)
- What triggers the video player to recalculate dimensions?

#### 2.3 Sidebar Positioner (e.g., `netflix-sidebar-positioner.js`)

**Purpose**: Keep sidebar positioned and sized correctly relative to video player

**YouTube Example**: `sidebar-positioner.js` syncs sidebar height/position with video

**What to implement**:
```javascript
class NetflixSidebarPositioner {
  constructor(sidebarElement, layoutManager) {
    this.sidebar = sidebarElement;
    this.layoutManager = layoutManager;
    this.resizeObserver = null;
    this.isActive = false;
  }

  start() {
    // Initial sync
    this._syncPosition();

    // Watch for video player size changes
    this._setupResizeObserver();
  }

  stop() {
    this._disconnectObservers();
  }

  _syncPosition() {
    const videoPlayer = this.layoutManager.getVideoPlayerContainer();
    const containerElement = document.querySelector('.netflix-container');

    const playerRect = videoPlayer.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    // Position sidebar relative to container
    const topOffset = playerRect.top - containerRect.top;

    this.sidebar.style.setProperty('height', `${playerRect.height}px`, 'important');
    this.sidebar.style.setProperty('top', `${topOffset}px`, 'important');
  }

  _setupResizeObserver() {
    const videoPlayer = this.layoutManager.getVideoPlayerContainer();
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isActive) {
        this._syncPosition();
      }
    });
    this.resizeObserver.observe(videoPlayer);
  }

  cleanup() {
    this.stop();
  }
}
```

**Key Questions**:
- Where should the sidebar be injected? (Body, video container, etc.)
- What element should the sidebar be positioned relative to?
- How does the video player resize? (User resizing window, platform controls)

### Step 3: Create Platform-Specific Sidebar Controller

Create `netflix-sidebar.js` (analogous to `youtube-sidebar.js`):

```javascript
class NetflixSidebar {
  constructor() {
    this.sidebar = null;
    this.isVisible = false;

    // Instantiate platform-specific modules
    this.fullscreenModeController = new NetflixFullscreenModeController();
    this.layoutManager = new NetflixLayoutManager();
    this.sidebarPositioner = null;

    if (this.isNetflixPage()) {
      this._init();
    }
  }

  async _init() {
    await this._loadSidebar();
    this._setupEventListeners();

    // Initialize positioner after sidebar exists
    this.sidebarPositioner = new NetflixSidebarPositioner(
      this.sidebar,
      this.layoutManager
    );

    if (this.isWatchPage()) {
      await this.show();
    }
  }

  async show() {
    // Enable optimal viewing mode
    await this.fullscreenModeController.enable();

    // Show sidebar
    this.sidebar.classList.remove('hidden');
    this.isVisible = true;

    // Activate layout
    this.layoutManager.activate();

    // Start positioning
    if (this.sidebarPositioner) {
      this.sidebarPositioner.start();
    }
  }

  hide() {
    this.sidebar.classList.add('hidden');
    this.isVisible = false;

    // Deactivate layout
    this.layoutManager.deactivate();

    // Stop positioning
    if (this.sidebarPositioner) {
      this.sidebarPositioner.stop();
    }
  }

  isNetflixPage() {
    return window.location.hostname.includes('netflix.com');
  }

  isWatchPage() {
    return window.location.pathname.includes('/watch');
  }
}
```

### Step 4: Create Platform-Specific CSS

Create `netflix-sidebar.css`:

```css
/* ============================================================================
   Netflix Layout Modifications
   ============================================================================ */

/* STATE 1: SIDEBAR ACTIVE */
body.helios-sidebar-active .watch-video--player-view {
  max-width: calc(100vw - 420px) !important;
}

/* STATE 2: SIDEBAR CLOSED */
body:not(.helios-sidebar-active) .watch-video--player-view {
  max-width: unset !important;
  width: unset !important;
}

/* Sidebar container */
.helios-netflix-sidebar {
  position: absolute !important;
  top: 0 !important;
  right: 0 !important;
  width: 420px !important;
  z-index: 9999 !important;
  /* ... rest of sidebar styles ... */
}
```

### Step 5: Register Platform in Manifest

Add your new scripts to `manifest.json`:

```json
{
  "content_scripts": [
    {
      "matches": ["*://*.netflix.com/*"],
      "js": [
        "src/content/video/netflix/fullscreen-mode-controller.js",
        "src/content/video/netflix/layout-manager.js",
        "src/content/video/netflix/sidebar-positioner.js",
        "src/content/netflix-sidebar.js"
      ],
      "css": [
        "src/ui/netflix-sidebar/netflix-sidebar.css"
      ]
    }
  ]
}
```

## Common Patterns & Solutions

### Pattern 1: Detecting Video Player

**Problem**: Finding the video player element across different platforms

**Solution**: Use platform-specific selectors in `getVideoPlayerContainer()`:

```javascript
// YouTube
getVideoPlayerContainer() {
  return document.querySelector('.html5-video-player');
}

// Netflix
getVideoPlayerContainer() {
  return document.querySelector('.watch-video--player-view');
}

// Generic fallback
getVideoPlayerContainer() {
  return document.querySelector('video')?.parentElement;
}
```

### Pattern 2: Forcing Layout Recalculation

**Problem**: Platform doesn't recognize layout changes

**Solution**: Trigger resize events or toggle modes:

```javascript
// Method 1: Window resize
window.dispatchEvent(new Event('resize'));

// Method 2: Toggle mode (YouTube approach)
element.removeAttribute('theater');
setTimeout(() => {
  element.setAttribute('theater', '');
}, 50);

// Method 3: Force reflow
void element.offsetHeight;
```

### Pattern 3: Fighting Platform JavaScript

**Problem**: Platform's JavaScript keeps overriding your CSS

**Solution**: Use MutationObserver to re-apply changes:

```javascript
_setupLayoutMaintenanceObserver() {
  const observer = new MutationObserver(() => {
    if (this.isActive && !document.body.classList.contains('helios-sidebar-active')) {
      document.body.classList.add('helios-sidebar-active');
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });

  this.observers.push(observer);
}
```

### Pattern 4: Sidebar Injection Point

**Problem**: Where to inject the sidebar in the DOM

**Solution**: Inject into the video container (not body):

```javascript
// YouTube: Inject into theater container
const watchFlexy = document.querySelector('ytd-watch-flexy');
watchFlexy.appendChild(this.sidebar);

// Netflix: Inject into watch container
const watchContainer = document.querySelector('.watch-video');
watchContainer.appendChild(this.sidebar);

// Generic: Inject into body as last resort
document.body.appendChild(this.sidebar);
```

## Testing Checklist

When implementing a new platform, verify:

- [ ] Sidebar opens smoothly without breaking page layout
- [ ] Video player adjusts to make room for sidebar (not covered by it)
- [ ] Sidebar closes and page returns to normal state
- [ ] Toggling sidebar multiple times works consistently
- [ ] Resizing browser window maintains correct layout
- [ ] User can still access all platform controls (settings, fullscreen, etc.)
- [ ] Sidebar stays synchronized with video player (height, position)
- [ ] No console errors or warnings
- [ ] Platform's native video features still work (play, pause, seek, quality)

## Debugging Tips

### Issue: Sidebar covers video instead of pushing it

**Cause**: Layout manager isn't constraining video width

**Fix**: Check CSS selectors in layout-manager CSS and ensure they target the correct container

### Issue: Video doesn't reset when sidebar closes

**Cause**: CSS reset isn't working or browser isn't recalculating

**Fix**: Add `_triggerVideoResize()` or toggle platform mode in `deactivate()`

### Issue: Sidebar position jumps around

**Cause**: Positioner is using wrong reference element

**Fix**: Verify parent container in `_syncPosition()` and ensure sidebar is positioned `absolute` within correct parent

### Issue: Platform JavaScript keeps fighting changes

**Cause**: Platform has aggressive layout management

**Fix**: Use `MutationObserver` to re-apply changes and increase CSS specificity with `!important`

## Best Practices

1. **Always use CSS classes over inline styles** - Makes debugging and maintenance easier
2. **Debounce resize observers** - Prevents performance issues with frequent updates
3. **Clean up observers in cleanup()** - Prevents memory leaks
4. **Document platform-specific quirks** - Future you will thank you
5. **Use meaningful variable names** - `watchFlexy` is clear, `elem1` is not
6. **Add timing constants** - `RESIZE_DELAY = 100` is better than magic numbers
7. **Log state changes** - `console.log('[Platform] Action')` helps debugging

## Example: Minimal Platform Implementation

Here's the bare minimum needed for a new platform:

```javascript
// 1. Mode Controller (~50 lines)
class PlatformModeController {
  isActive() { /* ... */ }
  async enable() { /* ... */ }
  cleanup() { /* ... */ }
}

// 2. Layout Manager (~100 lines)
class PlatformLayoutManager {
  activate() {
    document.body.classList.add('helios-sidebar-active');
    this._triggerVideoResize();
  }
  deactivate() {
    document.body.classList.remove('helios-sidebar-active');
    this._cleanupInlineStyles();
  }
  getVideoPlayerContainer() { /* ... */ }
}

// 3. Sidebar Positioner (~80 lines)
class PlatformSidebarPositioner {
  start() { this._syncPosition(); this._setupResizeObserver(); }
  stop() { this._disconnectObservers(); }
  _syncPosition() { /* ... */ }
}

// 4. Main Sidebar Controller (~150 lines)
class PlatformSidebar {
  constructor() {
    this.modeController = new PlatformModeController();
    this.layoutManager = new PlatformLayoutManager();
    this.positioner = null;
  }
  async show() { /* ... */ }
  hide() { /* ... */ }
}
```

**Total**: ~400 lines of code for a new platform (plus CSS)

## Conclusion

The modular architecture makes adding new platforms straightforward:

1. Copy the YouTube modules as a template
2. Adjust DOM selectors for your platform
3. Handle platform-specific quirks (mode toggling, layout recalculation)
4. Test thoroughly
5. Ship it! 🚀

**Estimated time to add a new platform**: 2-4 hours for experienced developer

Questions? Check the YouTube implementation - it's fully documented and serves as the reference implementation.
