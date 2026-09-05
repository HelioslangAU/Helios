/**
 * Central declarations for Helios globals attached to `window`.
 *
 * The extension runs the same modules in several contexts (content scripts,
 * popup, options, onboarding, offscreen). The shared feature instances now live
 * in the typed registry at `@/content/services`; what remains here is a handful
 * of constructors and legacy globals still reached through `window`.
 */

import type { AnkiManager } from '@/content/anki-manager';
import type { PageProcessor } from '@/content/page-processor';
import type { ContentSettingsApplier } from '@/content/settings/content-settings-applier';
import type { HeliosSettingsManager } from '@/content/settings/helios-settings';
import type { ShortcutHelper } from '@/content/utils/shortcut-helper';
import type { HeliosAudioRecorder } from '@/services/audio-recorder';
import type { ScreenshotCapturer } from '@/services/screenshot-capturer';

declare global {
  interface Window {
    // ---- Runtime instances (created during content/page init) ----
    // The shared feature instances now live in the typed registry at
    // `@/content/services`; only these stragglers are still read off `window`.
    heliosSettings: HeliosSettingsManager;

    /** Never assigned; the code reading it is dead. */
    heliosPageProcessor?: PageProcessor;
    /** Legacy: pinyin manager was removed; reads must handle absence. */
    pinyinManager?: undefined;

    // ---- Constructors exposed for cross-context/legacy access ----
    AnkiManager: typeof AnkiManager;
    ContentSettingsApplier: typeof ContentSettingsApplier;
    ShortcutHelper: typeof ShortcutHelper;
    HeliosAudioRecorder: HeliosAudioRecorder;
    HeliosScreenshotCapturer: ScreenshotCapturer;
    /** Legacy: wikimedia audio provider was removed; reads must handle absence. */
    WikimediaAudioProvider?: undefined;

    // ---- Third-party page globals (YouTube page context) ----
    ytcfg?: { data_?: Record<string, unknown>; get?: (key: string) => unknown };
    ytInitialData?: Record<string, unknown>;
  }
}

export {};
