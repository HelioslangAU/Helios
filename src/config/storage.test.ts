import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  items,
  recentVocabItem,
  storage,
  defaultVideoPlayerSettings,
  type VocabEntry,
} from '@/config/storage';

/**
 * These tests document the storage contract the rest of the extension relies
 * on: items with a `fallback` default their reads, items without one answer
 * `null` (migration code branches on that difference), and every `local:<name>`
 * item addresses the same raw `chrome.storage.local` key the extension has
 * always written.
 */
describe('storage items', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('fallbacks', () => {
    it('returns the declared fallback when the key is unset', async () => {
      expect(await items.extensionEnabled.getValue()).toBe(true);
      expect(await items.nativeLanguage.getValue()).toBe('en');
      expect(await items.activationKey.getValue()).toBe('Shift');
      expect(await items.popupTheme.getValue()).toBe('dark');
      expect(await items.sessionCount.getValue()).toBe(0);
      expect(await items.vocabList.getValue()).toEqual([]);
      expect(await items.knownWordsByLanguage.getValue()).toEqual({});
      expect(await items.hasCompletedOnboarding.getValue()).toBe(false);
    });

    it('returns the stored value once set, not the fallback', async () => {
      await items.extensionEnabled.setValue(false);
      await items.nativeLanguage.setValue('vi');
      expect(await items.extensionEnabled.getValue()).toBe(false);
      expect(await items.nativeLanguage.getValue()).toBe('vi');
    });

    it('does not confuse a stored falsy value with an unset key', async () => {
      await items.sessionCount.setValue(0);
      await items.popupTheme.setValue('');
      expect(await items.sessionCount.getValue()).toBe(0);
      expect(await items.popupTheme.getValue()).toBe('');
    });

    it('exposes the fallback on the item itself', () => {
      expect(items.extensionEnabled.fallback).toBe(true);
      expect(items.activationKey.fallback).toBe('Shift');
    });
  });

  describe('items declared without a fallback', () => {
    // Migration code distinguishes "never chosen" from "chosen"; these items
    // must answer null rather than inventing a default.
    it('returns null when unset', async () => {
      expect(await items.targetLanguage.getValue()).toBeNull();
      expect(await items.lastResetDate.getValue()).toBeNull();
      expect(await items.lastAnkiResetDate.getValue()).toBeNull();
      expect(await items.ankiSettings.getValue()).toBeNull();
      expect(await items.videoPlayer.getValue()).toBeNull();
      expect(await items.installDate.getValue()).toBeNull();
      expect(await items.onboardingCompletedDate.getValue()).toBeNull();
    });

    it('returns null for the legacy subtitle keys until something writes them', async () => {
      expect(await items.subtitlePosition.getValue()).toBeNull();
      expect(await items.subtitleSize.getValue()).toBeNull();
      expect(await items.subtitleVisibility.getValue()).toBeNull();
      expect(await items.ytSidebarSettings.getValue()).toBeNull();
    });

    it('returns the stored value once written', async () => {
      await items.targetLanguage.setValue('zh');
      await items.lastResetDate.setValue('2026-01-04');
      await items.subtitleVisibility.setValue(false);
      expect(await items.targetLanguage.getValue()).toBe('zh');
      expect(await items.lastResetDate.getValue()).toBe('2026-01-04');
      expect(await items.subtitleVisibility.getValue()).toBe(false);
    });

    it('reports `null` fallback, so `?? default` at a call site still works', () => {
      expect(items.targetLanguage.fallback).toBeNull();
      expect(items.lastResetDate.fallback).toBeNull();
    });
  });

  describe('setValue / getValue round-trips', () => {
    it('round-trips a boolean', async () => {
      await items.videoFeatureEnabled.setValue(false);
      expect(await items.videoFeatureEnabled.getValue()).toBe(false);
    });

    it('round-trips a number', async () => {
      await items.totalLookups.setValue(120);
      expect(await items.totalLookups.getValue()).toBe(120);
    });

    it('round-trips a string', async () => {
      await items.extensionVersion.setValue('1.3.5');
      expect(await items.extensionVersion.getValue()).toBe('1.3.5');
    });

    it('round-trips an array of objects without mangling it', async () => {
      const vocabList: VocabEntry[] = [
        { word: '中国', definition: 'China', pinyin: 'zhōng guó', dateAdded: '2026-01-04', reviewCount: 3 },
        { word: '人民', definition: 'the people', pinyin: 'rén mín', dateAdded: '2026-01-05', reviewCount: 0 },
      ];
      await items.vocabList.setValue(vocabList);
      expect(await items.vocabList.getValue()).toEqual(vocabList);
    });

    it('round-trips a record keyed by language code', async () => {
      const knownWordsByLanguage = { zh: ['中国', '人民'], ja: ['日本語'] };
      await items.knownWordsByLanguage.setValue(knownWordsByLanguage);
      expect(await items.knownWordsByLanguage.getValue()).toEqual(knownWordsByLanguage);
    });

    it('round-trips a nested object with its own nested records', async () => {
      const settings = defaultVideoPlayerSettings();
      settings.dualSubtitlesEnabled = true;
      settings.secondarySubtitleLanguage = 'en';
      settings.hotkeys.next = { key: 'l', shift: true, ctrl: false, alt: false };
      await items.videoPlayer.setValue(settings);

      const stored = await items.videoPlayer.getValue();
      expect(stored).toEqual(settings);
      expect(stored!.hotkeys.next).toEqual({ key: 'l', shift: true, ctrl: false, alt: false });
      expect(stored!.hotkeys.previous.key).toBe('a');
    });

    it('overwrites a previously stored value', async () => {
      await items.targetLanguage.setValue('zh');
      await items.targetLanguage.setValue('ja');
      expect(await items.targetLanguage.getValue()).toBe('ja');
    });

    it('keeps items independent of one another', async () => {
      await items.targetLanguage.setValue('zh');
      await items.nativeLanguage.setValue('vi');
      expect(await items.targetLanguage.getValue()).toBe('zh');
      expect(await items.nativeLanguage.getValue()).toBe('vi');
    });
  });

  describe('removeValue', () => {
    it('returns an item with a fallback to that fallback', async () => {
      await items.extensionEnabled.setValue(false);
      await items.extensionEnabled.removeValue();
      expect(await items.extensionEnabled.getValue()).toBe(true);
    });

    it('returns an item without a fallback to null', async () => {
      await items.targetLanguage.setValue('zh');
      await items.targetLanguage.removeValue();
      expect(await items.targetLanguage.getValue()).toBeNull();
    });

    it('leaves other items untouched', async () => {
      await items.targetLanguage.setValue('zh');
      await items.nativeLanguage.setValue('vi');
      await items.targetLanguage.removeValue();
      expect(await items.nativeLanguage.getValue()).toBe('vi');
    });

    it('is a no-op for an item that was never written', async () => {
      await items.vocabList.removeValue();
      expect(await items.vocabList.getValue()).toEqual([]);
    });

    it('makes a removed item readable again after re-writing it', async () => {
      await items.sessionCount.setValue(7);
      await items.sessionCount.removeValue();
      await items.sessionCount.setValue(1);
      expect(await items.sessionCount.getValue()).toBe(1);
    });
  });

  describe('batch getItems / setItems', () => {
    it('writes several items in one call', async () => {
      await storage.setItems([
        { item: items.sessionCount, value: 0 },
        { item: items.lastResetDate, value: '2026-01-04' },
        { item: items.targetLanguage, value: 'zh' },
      ]);
      expect(await items.sessionCount.getValue()).toBe(0);
      expect(await items.lastResetDate.getValue()).toBe('2026-01-04');
      expect(await items.targetLanguage.getValue()).toBe('zh');
    });

    it('reads several items in the requested order', async () => {
      await items.extensionEnabled.setValue(false);
      await items.activationKey.setValue('Alt');

      const [enabled, key] = await storage.getItems([items.extensionEnabled, items.activationKey]);
      expect(enabled.key).toBe('local:extensionEnabled');
      expect(enabled.value).toBe(false);
      expect(key.key).toBe('local:activationKey');
      expect(key.value).toBe('Alt');
    });

    it('applies each item’s fallback for keys that are unset', async () => {
      const [enabled, lang] = await storage.getItems([items.extensionEnabled, items.targetLanguage]);
      expect(enabled.value).toBe(true);
      expect(lang.value).toBeNull();
    });
  });

  describe('recentVocabItem', () => {
    it('builds a distinct key per language code', () => {
      expect(recentVocabItem('zh').key).toBe('local:recentVocab_zh');
      expect(recentVocabItem('ja').key).toBe('local:recentVocab_ja');
    });

    it('falls back to an empty list', async () => {
      expect(await recentVocabItem('zh').getValue()).toEqual([]);
    });

    it('does not let two language codes collide', async () => {
      const zh: VocabEntry[] = [{ word: '謝謝', pinyin: 'xiè xie' }];
      const ja: VocabEntry[] = [{ word: 'ありがとう' }];
      await recentVocabItem('zh').setValue(zh);
      await recentVocabItem('ja').setValue(ja);

      expect(await recentVocabItem('zh').getValue()).toEqual(zh);
      expect(await recentVocabItem('ja').getValue()).toEqual(ja);
    });

    it('addresses the same storage for two items built from the same code', async () => {
      await recentVocabItem('zh').setValue([{ word: '謝謝' }]);
      expect(await recentVocabItem('zh').getValue()).toEqual([{ word: '謝謝' }]);
    });
  });

  describe('watch', () => {
    it('fires with the new and old value on change', async () => {
      const cb = vi.fn();
      const unwatch = items.targetLanguage.watch(cb);

      await items.targetLanguage.setValue('zh');
      expect(cb).toHaveBeenCalledWith('zh', null);

      await items.targetLanguage.setValue('ja');
      expect(cb).toHaveBeenLastCalledWith('ja', 'zh');

      unwatch();
    });

    it('reports the fallback rather than null when a value is removed', async () => {
      const cb = vi.fn();
      await items.extensionEnabled.setValue(false);
      const unwatch = items.extensionEnabled.watch(cb);

      await items.extensionEnabled.removeValue();
      expect(cb).toHaveBeenCalledWith(true, false);

      unwatch();
    });

    it('stops firing once the returned unwatch is called', async () => {
      const cb = vi.fn();
      const unwatch = items.sessionCount.watch(cb);

      await items.sessionCount.setValue(1);
      expect(cb).toHaveBeenCalledTimes(1);

      unwatch();
      await items.sessionCount.setValue(2);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(await items.sessionCount.getValue()).toBe(2);
    });

    it('does not fire for changes to a different item', async () => {
      const cb = vi.fn();
      const unwatch = items.targetLanguage.watch(cb);

      await items.nativeLanguage.setValue('vi');
      expect(cb).not.toHaveBeenCalled();

      unwatch();
    });
  });

  /**
   * The whole point of declaring keys as `local:<name>`: an existing install's
   * data lives at bare `chrome.storage.local` keys written by the pre-WXT code,
   * and the items must read and write exactly those keys — no prefix, no
   * wrapper object. If these break, every existing user loses their vocab.
   */
  describe('storage-key compatibility with existing installs', () => {
    it('reads a raw `vocabList` key written directly to browser.storage.local', async () => {
      const vocabList: VocabEntry[] = [
        { word: '中国', definition: 'China', pinyin: 'zhōng guó', dateAdded: '2026-01-04' },
      ];
      await fakeBrowser.storage.local.set({ vocabList });

      expect(await items.vocabList.getValue()).toEqual(vocabList);
    });

    it('writes back to the same raw key, with no `local:` prefix in storage', async () => {
      await items.vocabList.setValue([{ word: '人民' }]);

      const raw = await fakeBrowser.storage.local.get(null);
      expect(raw.vocabList).toEqual([{ word: '人民' }]);
      expect(raw).not.toHaveProperty('local:vocabList');
    });

    it('reads the other pre-existing keys an upgraded install already holds', async () => {
      await fakeBrowser.storage.local.set({
        extensionEnabled: false,
        targetLanguage: 'zh',
        knownWords: ['中国'],
        hasCompletedOnboarding: true,
        installDate: '2025-11-02T00:00:00.000Z',
        recentVocab_zh: [{ word: '謝謝' }],
      });

      expect(await items.extensionEnabled.getValue()).toBe(false);
      expect(await items.targetLanguage.getValue()).toBe('zh');
      expect(await items.knownWords.getValue()).toEqual(['中国']);
      expect(await items.hasCompletedOnboarding.getValue()).toBe(true);
      expect(await items.installDate.getValue()).toBe('2025-11-02T00:00:00.000Z');
      expect(await recentVocabItem('zh').getValue()).toEqual([{ word: '謝謝' }]);
    });

    it('removes the raw key, leaving nothing behind for the old code to find', async () => {
      await fakeBrowser.storage.local.set({ targetLanguage: 'zh' });
      await items.targetLanguage.removeValue();

      const raw = await fakeBrowser.storage.local.get(null);
      expect(raw).not.toHaveProperty('targetLanguage');
    });
  });
});
