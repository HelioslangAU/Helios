import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoConstants } from '@/content/video/config/video-constants';
import {
  adjustVideoLayout,
  applyPlatformPositioning,
  removeVideoLayoutAdjustment,
  resetFullscreenStyles,
  syncSidebarPosition
} from '@/content/video/sidebar/video-layout';

/**
 * These functions read `window.location.hostname` and reach into the page, so
 * each test builds the elements the platform branch looks for and points the
 * URL at that platform. Timers are faked: the retry/`resize` bounces the
 * functions schedule would otherwise fire after the test finished.
 */
function setHost(url: string): void {
  (window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(url);
}

function div(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('applyPlatformPositioning', () => {
  it('pins the sidebar to the right edge at full viewport height', () => {
    const sidebar = div('helios-sidebar');

    applyPlatformPositioning(sidebar);

    expect(sidebar.style.getPropertyValue('position')).toBe('fixed');
    expect(sidebar.style.getPropertyValue('right')).toBe('0px');
    expect(sidebar.style.getPropertyValue('top')).toBe('0px');
    expect(sidebar.style.getPropertyValue('height')).toBe('100vh');
    expect(sidebar.style.getPropertyValue('width')).toBe(`${VideoConstants.SIDEBAR_WIDTH}px`);
    expect(sidebar.style.getPropertyValue('z-index')).toBe(VideoConstants.Z_INDEX.SIDEBAR.toString());
  });

  it('leaves the sidebar hidden', () => {
    const sidebar = div('helios-sidebar');

    applyPlatformPositioning(sidebar);

    expect(sidebar.style.getPropertyValue('display')).toBe('none');
    expect(sidebar.style.getPropertyValue('visibility')).toBe('hidden');
    expect(sidebar.style.getPropertyValue('opacity')).toBe('0');
  });

  it('marks every declaration important so the platform CSS cannot win', () => {
    const sidebar = div('helios-sidebar');

    applyPlatformPositioning(sidebar);

    expect(sidebar.style.getPropertyPriority('position')).toBe('important');
    expect(sidebar.style.getPropertyPriority('display')).toBe('important');
  });
});

describe('syncSidebarPosition', () => {
  it('uses the normal stacking order outside fullscreen', () => {
    const sidebar = div('helios-sidebar');

    syncSidebarPosition(sidebar, false);

    expect(sidebar.style.getPropertyValue('height')).toBe('100vh');
    expect(sidebar.style.getPropertyValue('position')).toBe('fixed');
    expect(sidebar.style.getPropertyValue('z-index')).toBe(VideoConstants.Z_INDEX.SIDEBAR.toString());
  });

  it('raises the sidebar above the fullscreen element in fullscreen', () => {
    const sidebar = div('helios-sidebar');

    syncSidebarPosition(sidebar, true);

    expect(sidebar.style.getPropertyValue('height')).toBe('100vh');
    expect(sidebar.style.getPropertyValue('z-index')).toBe(VideoConstants.Z_INDEX.SIDEBAR_FULLSCREEN.toString());
  });
});

describe('adjustVideoLayout — windowed', () => {
  it('narrows the Netflix player by the sidebar width and stops the page scrolling sideways', () => {
    setHost('https://www.netflix.com/watch/80100172');
    const container = div('watch-video');

    adjustVideoLayout();

    expect(container.style.getPropertyValue('width')).toBe(`calc(100% - ${VideoConstants.SIDEBAR_WIDTH}px)`);
    expect(container.style.getPropertyValue('max-width')).toBe(`calc(100vw - ${VideoConstants.SIDEBAR_WIDTH}px)`);
    expect(document.body.style.overflowX).toBe('hidden');
  });

  it('narrows the Disney+ player', () => {
    setHost('https://www.disneyplus.com/video/abc');
    const container = div('btm-media-player-root');

    adjustVideoLayout();

    expect(container.style.getPropertyValue('width')).toBe(`calc(100% - ${VideoConstants.SIDEBAR_WIDTH}px)`);
  });

  it('retries later when the player container is not in the DOM yet', () => {
    setHost('https://www.netflix.com/watch/80100172');

    adjustVideoLayout();
    const container = div('watch-video');
    vi.advanceTimersByTime(VideoConstants.TIMING.LAYOUT_RETRY);

    expect(container.style.getPropertyValue('width')).toBe(`calc(100% - ${VideoConstants.SIDEBAR_WIDTH}px)`);
  });

  it('nudges Netflix into recalculating with a resize event', () => {
    setHost('https://www.netflix.com/watch/80100172');
    div('watch-video');
    const onResize = vi.fn();
    window.addEventListener('resize', onResize);

    adjustVideoLayout();
    vi.advanceTimersByTime(50);
    window.removeEventListener('resize', onResize);

    expect(onResize).toHaveBeenCalled();
  });

  it('leaves an unknown platform alone', () => {
    setHost('https://example.com/watch');
    const container = div('watch-video');

    adjustVideoLayout();

    expect(container.getAttribute('style')).toBeNull();
    expect(document.body.style.overflowX).toBe('');
  });
});

describe('removeVideoLayoutAdjustment', () => {
  it('restores every Netflix element it had sized', () => {
    setHost('https://www.netflix.com/watch/80100172');
    const container = div('watch-video');
    const controls = div('PlayerControlsNeo__all-controls');
    adjustVideoLayout();
    expect(container.style.getPropertyValue('width')).not.toBe('');

    removeVideoLayoutAdjustment();

    expect(container.style.getPropertyValue('width')).toBe('');
    expect(container.style.getPropertyValue('max-width')).toBe('');
    expect(controls.style.getPropertyValue('width')).toBe('');
    expect(document.body.style.getPropertyValue('overflow-x')).toBe('');
  });

  it('restores the Prime Video container', () => {
    setHost('https://www.primevideo.com/detail/xyz');
    const container = div('dv-player-fullscreen');
    adjustVideoLayout();
    expect(container.style.getPropertyValue('width')).not.toBe('');

    removeVideoLayoutAdjustment();

    expect(container.style.getPropertyValue('width')).toBe('');
    expect(container.style.getPropertyValue('transition')).toBe('');
  });
});

describe('resetFullscreenStyles', () => {
  it('clears the sizing Netflix elements were given for fullscreen', () => {
    setHost('https://www.netflix.com/watch/80100172');
    const player = div('NFPlayer');
    player.style.setProperty('width', '100px', 'important');
    player.style.setProperty('position', 'absolute', 'important');
    const subtitles = div('player-timedtext-text-container');
    subtitles.style.setProperty('max-width', '100px', 'important');

    resetFullscreenStyles();

    expect(player.style.getPropertyValue('width')).toBe('');
    expect(player.style.getPropertyValue('position')).toBe('');
    expect(subtitles.style.getPropertyValue('max-width')).toBe('');
  });

  it('does nothing off Netflix', () => {
    setHost('https://www.disneyplus.com/video/abc');
    const player = div('NFPlayer');
    player.style.setProperty('width', '100px', 'important');

    resetFullscreenStyles();

    expect(player.style.getPropertyValue('width')).toBe('100px');
  });
});
