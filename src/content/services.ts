/**
 * Shared content-script services.
 *
 * These are the few long-lived instances that genuinely need to be reachable
 * from across the content script — the language registry, the dictionary, the
 * vocabulary store, and the UI managers that other features drive.
 *
 * They used to be published onto `window` and read back by name, which was
 * untyped, invisible to the compiler, and impossible to stub in a test. This
 * module keeps the same single-instance model but makes it typed and
 * greppable: the content orchestrator calls `provideServices()` during init,
 * and everything else reads through `services`.
 *
 * This is a registry, not constructor injection. Threading every dependency
 * through constructors would be cleaner still, but it would mean reshaping
 * call signatures across several 2,000-line UI classes at once; the registry
 * removes the untyped coupling without that risk.
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

import type { AnkiManager } from '@/content/anki-manager';
import type { BannerManager } from '@/content/banner-manager';
import type { DictionaryManagerProxy } from '@/content/dictionary-bridge';
import type { DictionaryManager } from '@/content/dictionary-manager';
import type { LanguageRegistry } from '@/content/languages/language-registry';
import type { PageProcessor } from '@/content/page-processor';
import type { PopupManager } from '@/content/popup/popup-manager';
import type { PronunciationManager } from '@/content/pronunciation-manager';
import type { HighlightManager } from '@/content/text-highlighter';
import type { VocabManager } from '@/content/vocab-manager';
import type { PlatformVideoSidebar } from '@/content/video/platform-video-sidebar';
import type { SubtitleSelectorModal } from '@/content/video/ui/subtitle-selector-modal';
import type { VideoFeatureManager } from '@/content/video/video-feature-manager';
import type { YouTubeSidebar } from '@/content/youtube-sidebar';

export interface HeliosServices {
  /**
   * The content script's lifetime. Timers and listeners registered through
   * `ctx` are torn down automatically when the script is invalidated — which
   * happens on extension reload and on SPA navigation away from the page.
   * Prefer `ctx.setInterval` / `ctx.addEventListener` over the bare globals.
   */
  ctx: ContentScriptContext;
  languageRegistry: LanguageRegistry;
  /**
   * Content scripts get the proxy (lookups hop to the offscreen document);
   * the options page constructs a plain DictionaryManager directly.
   */
  dictionaryManager: DictionaryManager | DictionaryManagerProxy;
  vocabManager: VocabManager;
  pageProcessor: PageProcessor;
  highlightManager: HighlightManager;
  popupManager: PopupManager;
  pronunciationManager: PronunciationManager;
  bannerManager: BannerManager;
  ankiManager: AnkiManager;
  videoFeature: VideoFeatureManager;
  youtubeSidebar: YouTubeSidebar;
  platformVideoSidebar: PlatformVideoSidebar;
  subtitleSelectorModal: SubtitleSelectorModal;
}

const registry: Partial<HeliosServices> = {};

/**
 * Register services as they are constructed. Called during content-script init,
 * and by the video features when they come up later on a media page.
 */
export function provideServices(provided: Partial<HeliosServices>): void {
  Object.assign(registry, provided);
}

/**
 * The shared services. Every entry is optional: features initialize in stages
 * (the video stack only exists on media pages), so readers must handle absence
 * exactly as they did when reading `window`.
 */
export const services: Readonly<Partial<HeliosServices>> = registry;

/**
 * Withdraw a single service. Teardown paths must call this so a destroyed
 * instance stops being handed out — absence is how the registry models the
 * `null` these features used to assign to `window`.
 */
export function revokeService(key: keyof HeliosServices): void {
  delete registry[key];
}

/** Drop all registered services. Used when the content script is torn down. */
export function clearServices(): void {
  for (const key of Object.keys(registry) as Array<keyof HeliosServices>) {
    delete registry[key];
  }
}
