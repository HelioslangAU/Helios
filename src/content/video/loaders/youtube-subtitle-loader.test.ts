import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YouTubeSubtitleLoader } from '@/content/video/loaders/youtube-subtitle-loader';
import type { VideoDetector } from '@/content/video/core/video-detector';

/**
 * YouTube is a single-page app, so navigating between videos can start a
 * second track request while the first is still in flight. These tests pin the
 * behaviour of that overlap, which used to leave a promise unsettled forever.
 */

function respond(tracks: unknown[] | null, error?: string): void {
  window.dispatchEvent(
    new CustomEvent('helios-youtube-subtitles-response', {
      detail: tracks ? { success: true, tracks } : { success: false, error },
    }),
  );
}

/** Resolves to a marker if the promise has not settled by the next tick. */
async function settledOrPending<T>(p: Promise<T>): Promise<T | 'pending'> {
  return Promise.race([p, Promise.resolve('pending' as const)]);
}

describe('YouTubeSubtitleLoader track requests', () => {
  let loader: YouTubeSubtitleLoader;

  beforeEach(() => {
    vi.useFakeTimers();
    // The constructor injects a page script and only arms itself on YouTube.
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });
    // happy-dom refuses to fetch the injected page script and logs for it; the
    // injection is not what these tests are about.
    vi.spyOn(YouTubeSubtitleLoader.prototype, '_injectPageScript').mockImplementation(
      function (this: YouTubeSubtitleLoader) {
        this.pageScriptInjected = true;
      },
    );
    loader = new YouTubeSubtitleLoader({} as VideoDetector);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves with the tracks the page script sends back', async () => {
    const request = loader.getAvailableTracks();
    await Promise.resolve();

    respond([{ languageCode: 'zh' }]);

    await expect(request).resolves.toEqual([{ languageCode: 'zh' }]);
  });

  it('resolves empty when the page script reports a failure', async () => {
    const request = loader.getAvailableTracks();
    await Promise.resolve();

    respond(null, 'no player');

    await expect(request).resolves.toEqual([]);
  });

  it('gives up after five seconds', async () => {
    const request = loader.getAvailableTracks();
    await Promise.resolve();

    vi.advanceTimersByTime(5000);

    await expect(request).resolves.toEqual([]);
  });

  it('settles a superseded request instead of abandoning it', async () => {
    const first = loader.getAvailableTracks();
    await Promise.resolve();
    const second = loader.getAvailableTracks();
    await Promise.resolve();

    // The first request is closed out the moment it is superseded.
    await expect(first).resolves.toEqual([]);

    respond([{ languageCode: 'en' }]);
    await expect(second).resolves.toEqual([{ languageCode: 'en' }]);
  });

  it("does not let a finished request's timer cancel the next one", async () => {
    const first = loader.getAvailableTracks();
    await Promise.resolve();
    respond([{ languageCode: 'zh' }]);
    await expect(first).resolves.toEqual([{ languageCode: 'zh' }]);

    // Navigate a second later; the first request's 5s timer is still out there.
    vi.advanceTimersByTime(1000);
    const second = loader.getAvailableTracks();
    await Promise.resolve();

    // Past when the stale timer would have fired, the new request is intact.
    vi.advanceTimersByTime(4500);
    expect(await settledOrPending(second)).toBe('pending');

    respond([{ languageCode: 'fr' }]);
    await expect(second).resolves.toEqual([{ languageCode: 'fr' }]);
  });

  it('lets a late response for a superseded request pass harmlessly', async () => {
    const first = loader.getAvailableTracks();
    await Promise.resolve();
    const second = loader.getAvailableTracks();
    await Promise.resolve();
    await expect(first).resolves.toEqual([]);

    respond([{ languageCode: 'es' }]);
    await expect(second).resolves.toEqual([{ languageCode: 'es' }]);

    // A second response with nothing waiting must not throw.
    expect(() => respond([{ languageCode: 'de' }])).not.toThrow();
  });

  it('returns empty without dispatching when the page script is not in yet', async () => {
    loader.pageScriptInjected = false;
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    await expect(loader.getAvailableTracks()).resolves.toEqual([]);
    expect(dispatch).not.toHaveBeenCalled();

    dispatch.mockRestore();
  });
});
