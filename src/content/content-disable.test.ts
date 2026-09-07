import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChineseLanguageLearningExtension } from '@/content/content';

/**
 * Turning Helios off has to stop it on pages that are already open, not only
 * on the next one loaded. The storage listener used to be registered inside
 * init()'s disabled branch, so a page that started while Helios was on never
 * heard about being switched off: the marks, the hover lookup and the side tab
 * all carried on until the tab was reloaded.
 */

/** A page mid-session, with everything an enabled run stands up. */
function runningInstance(): {
  ext: ChineseLanguageLearningExtension;
  spies: Record<string, ReturnType<typeof vi.fn>>;
} {
  document.body.innerHTML = `
    <p>
      <span class="lang-unknown-word">学习</span>
      <span class="lang-learning-word">语言</span>
      <span class="chinese-unknown-word">世界</span>
      <span class="untouched">plain</span>
    </p>`;

  const spies = {
    unregister: vi.fn(),
    deactivate: vi.fn(),
    hidePopup: vi.fn(),
    removeAllPopups: vi.fn(),
    removeLookupHighlight: vi.fn(),
    processorCleanup: vi.fn(),
    videoDestroy: vi.fn(),
    sidebarDestroy: vi.fn(),
    hideBanner: vi.fn(),
  };

  // Built without the constructor: it kicks off async init() against storage,
  // which is not what these tests are about.
  const ext = Object.create(
    ChineseLanguageLearningExtension.prototype,
  ) as ChineseLanguageLearningExtension;

  ext.isRunning = true;
  ext.textScanner = { unregister: spies.unregister } as never;
  ext.activation = { toggleActivationMode: spies.deactivate } as never;
  ext.popup = {
    hidePopup: spies.hidePopup,
    removeAllPopupsFromPage: spies.removeAllPopups,
  } as never;
  ext.highlightManager = { removeLookupHighlight: spies.removeLookupHighlight } as never;
  ext.pageProcessor = { cleanup: spies.processorCleanup } as never;
  ext.videoFeature = { destroy: spies.videoDestroy } as never;
  ext.youtubeSidebar = { destroy: spies.sidebarDestroy } as never;
  ext.bannerManager = { hideBanner: spies.hideBanner } as never;

  return { ext, spies };
}

const marked = () =>
  document.querySelectorAll(
    '.lang-unknown-word, .lang-learning-word, .chinese-unknown-word',
  ).length;

describe('disabling Helios on a page already running', () => {
  let ext: ChineseLanguageLearningExtension;
  let spies: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    ({ ext, spies } = runningInstance());
  });

  it('takes the pointer and key listeners off', () => {
    ext.disable();
    expect(spies.unregister).toHaveBeenCalled();
    expect(spies.deactivate).toHaveBeenCalledWith(false);
  });

  it('closes any open card and its lookup highlight', () => {
    ext.disable();
    expect(spies.hidePopup).toHaveBeenCalled();
    expect(spies.removeAllPopups).toHaveBeenCalled();
    expect(spies.removeLookupHighlight).toHaveBeenCalled();
  });

  it('stops the observers and timers that would re-process the page', () => {
    ext.disable();
    expect(spies.processorCleanup).toHaveBeenCalled();
  });

  it('shuts down the video features and the side tab', () => {
    ext.disable();
    expect(spies.videoDestroy).toHaveBeenCalled();
    expect(spies.sidebarDestroy).toHaveBeenCalled();
    expect(spies.hideBanner).toHaveBeenCalled();
  });

  it('takes the marks off the words, leaving the page text alone', () => {
    expect(marked()).toBe(3);
    ext.disable();
    expect(marked()).toBe(0);
    expect(document.querySelectorAll('span').length).toBe(4);
    expect(document.body.textContent).toContain('学习');
  });

  it('is safe to call twice, and does nothing the second time', () => {
    ext.disable();
    ext.disable();
    expect(spies.unregister).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a page that was never running', () => {
    ext.isRunning = false;
    ext.disable();
    expect(spies.unregister).not.toHaveBeenCalled();
    expect(marked()).toBe(3);
  });

  it('survives a page where a feature was never stood up', () => {
    ext.videoFeature = null;
    ext.youtubeSidebar = null;
    ext.bannerManager = null;
    ext.pageProcessor = null;
    ext.popup = null;
    ext.highlightManager = null;

    expect(() => ext.disable()).not.toThrow();
    expect(spies.unregister).toHaveBeenCalled();
    expect(marked()).toBe(0);
  });
});
