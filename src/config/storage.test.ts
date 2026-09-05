import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storage, type VocabEntry } from '@/config/storage';

/**
 * These tests document the storage contract the rest of the extension relies
 * on: reads are *partial* (absent keys come back `undefined`, not defaulted),
 * writes merge rather than replace, and `setRaw` is the escape hatch for the
 * options page's runtime-keyed settings bag.
 */
describe('storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('get', () => {
    it('returns an empty object when none of the requested keys exist', async () => {
      expect(await storage.get(['extensionEnabled', 'targetLanguage'])).toEqual({});
    });

    it('leaves absent keys `undefined` rather than defaulting them', async () => {
      // The Partial<> contract: call sites must supply their own `?? default`.
      const result = await storage.get(['extensionEnabled', 'autoHighlight']);
      expect(result.extensionEnabled).toBeUndefined();
      expect(result.autoHighlight).toBeUndefined();
    });

    it('accepts a single key as a bare string', async () => {
      await storage.set({ targetLanguage: 'zh' });
      expect(await storage.get('targetLanguage')).toEqual({ targetLanguage: 'zh' });
    });

    it('returns only the requested keys, not the whole store', async () => {
      await storage.set({
        extensionEnabled: true,
        targetLanguage: 'zh',
        nativeLanguage: 'en',
        autoHighlight: false,
      });
      expect(await storage.get(['targetLanguage', 'nativeLanguage'])).toEqual({
        targetLanguage: 'zh',
        nativeLanguage: 'en',
      });
    });

    it('returns the present subset when only some requested keys exist', async () => {
      await storage.set({ targetLanguage: 'ja' });
      const result = await storage.get(['targetLanguage', 'nativeLanguage']);
      expect(result).toEqual({ targetLanguage: 'ja' });
      expect(result.nativeLanguage).toBeUndefined();
    });

    it('preserves falsy values instead of treating them as absent', async () => {
      await storage.set({ extensionEnabled: false, sessionCount: 0, popupTheme: '' });
      expect(await storage.get(['extensionEnabled', 'sessionCount', 'popupTheme'])).toEqual({
        extensionEnabled: false,
        sessionCount: 0,
        popupTheme: '',
      });
    });

    it('returns an empty object for an empty key list', async () => {
      await storage.set({ targetLanguage: 'zh' });
      expect(await storage.get([])).toEqual({});
    });
  });

  describe('set', () => {
    it('round-trips a primitive value', async () => {
      await storage.set({ extensionEnabled: true });
      expect(await storage.get(['extensionEnabled'])).toEqual({ extensionEnabled: true });
    });

    it('round-trips an array of objects without mangling it', async () => {
      const vocabList: VocabEntry[] = [
        { word: '中国', definition: 'China', pinyin: 'zhōng guó', dateAdded: '2026-01-04', reviewCount: 3 },
        { word: '人民', definition: 'the people', pinyin: 'rén mín', dateAdded: '2026-01-05', reviewCount: 0 },
      ];
      await storage.set({ vocabList });
      const result = await storage.get(['vocabList']);
      expect(result.vocabList).toEqual(vocabList);
    });

    it('round-trips a nested record keyed by language code', async () => {
      const knownWordsByLanguage = { zh: ['中国', '人民'], ja: ['日本語'] };
      await storage.set({ knownWordsByLanguage });
      expect((await storage.get(['knownWordsByLanguage'])).knownWordsByLanguage).toEqual(
        knownWordsByLanguage
      );
    });

    it('round-trips the templated recentVocab_<lang> key', async () => {
      const recent: VocabEntry[] = [{ word: '謝謝', pinyin: 'xiè xie' }];
      await storage.set({ recentVocab_zh: recent });
      expect((await storage.get(['recentVocab_zh'])).recentVocab_zh).toEqual(recent);
    });

    it('overwrites an existing value', async () => {
      await storage.set({ targetLanguage: 'zh' });
      await storage.set({ targetLanguage: 'ja' });
      expect(await storage.get(['targetLanguage'])).toEqual({ targetLanguage: 'ja' });
    });

    it('merges into the store rather than replacing it', async () => {
      await storage.set({ targetLanguage: 'zh', nativeLanguage: 'en' });
      await storage.set({ targetLanguage: 'ja' });
      expect(await storage.get(['targetLanguage', 'nativeLanguage'])).toEqual({
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });
    });

    it('writes several keys in one call', async () => {
      await storage.set({ sessionCount: 4, totalLookups: 120, lastResetDate: '2026-01-04' });
      expect(await storage.get(['sessionCount', 'totalLookups', 'lastResetDate'])).toEqual({
        sessionCount: 4,
        totalLookups: 120,
        lastResetDate: '2026-01-04',
      });
    });

    it('accepts an empty write without disturbing the store', async () => {
      await storage.set({ targetLanguage: 'zh' });
      await storage.set({});
      expect(await storage.get(['targetLanguage'])).toEqual({ targetLanguage: 'zh' });
    });
  });

  describe('getAll', () => {
    it('returns an empty object for an empty store', async () => {
      expect(await storage.getAll()).toEqual({});
    });

    it('returns every key that has been written', async () => {
      await storage.set({ extensionEnabled: true, targetLanguage: 'zh' });
      await storage.setRaw({ scanDelay: 300, debugMode: false });
      expect(await storage.getAll()).toEqual({
        extensionEnabled: true,
        targetLanguage: 'zh',
        scanDelay: 300,
        debugMode: false,
      });
    });

    it('includes keys written outside the typed surface', async () => {
      await storage.setRaw({ someLegacyOptionsPageKey: 'still here' });
      expect(await storage.getAll()).toHaveProperty('someLegacyOptionsPageKey', 'still here');
    });
  });

  describe('setRaw', () => {
    it('writes keys that are not declared in HeliosStorage', async () => {
      await storage.setRaw({ hotkeyMarkLearning: '4', experimentalFlag: true });
      const all = await storage.getAll();
      expect(all.hotkeyMarkLearning).toBe('4');
      expect(all.experimentalFlag).toBe(true);
    });

    it('writes a whole options-page settings bag at once', async () => {
      await storage.setRaw({
        scanDelay: 250,
        maxWordLength: 6,
        preferTraditional: true,
        highlightColor: '#4a90d9',
        disabledSites: ['mail.google.com', 'docs.google.com'],
      });
      expect(await storage.getAll()).toEqual({
        scanDelay: 250,
        maxWordLength: 6,
        preferTraditional: true,
        highlightColor: '#4a90d9',
        disabledSites: ['mail.google.com', 'docs.google.com'],
      });
    });

    it('shares one namespace with set — a raw write is readable through get', async () => {
      await storage.setRaw({ targetLanguage: 'zh' });
      expect(await storage.get(['targetLanguage'])).toEqual({ targetLanguage: 'zh' });
    });

    it('overwrites a value previously written through set', async () => {
      await storage.set({ scanDelay: 100 });
      await storage.setRaw({ scanDelay: 500 });
      expect(await storage.get(['scanDelay'])).toEqual({ scanDelay: 500 });
    });
  });

  describe('remove', () => {
    it('deletes a single key', async () => {
      await storage.set({ extensionEnabled: true });
      await storage.remove('extensionEnabled');
      expect(await storage.get(['extensionEnabled'])).toEqual({});
    });

    it('deletes several keys at once', async () => {
      await storage.set({ extensionEnabled: true, targetLanguage: 'zh', nativeLanguage: 'en' });
      await storage.remove(['extensionEnabled', 'targetLanguage']);
      expect(await storage.getAll()).toEqual({ nativeLanguage: 'en' });
    });

    it('leaves untouched keys in place', async () => {
      await storage.set({ targetLanguage: 'zh', nativeLanguage: 'en' });
      await storage.remove('targetLanguage');
      expect(await storage.get(['nativeLanguage'])).toEqual({ nativeLanguage: 'en' });
    });

    it('is a no-op for a key that was never written', async () => {
      await storage.set({ targetLanguage: 'zh' });
      await storage.remove('vocabList');
      expect(await storage.getAll()).toEqual({ targetLanguage: 'zh' });
    });

    it('makes a removed key readable again after re-writing it', async () => {
      await storage.set({ sessionCount: 7 });
      await storage.remove('sessionCount');
      await storage.set({ sessionCount: 1 });
      expect(await storage.get(['sessionCount'])).toEqual({ sessionCount: 1 });
    });
  });
});
