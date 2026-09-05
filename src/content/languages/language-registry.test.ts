import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseLanguageAdapter } from '@/content/languages/base-language-adapter';
import { ChineseLanguageAdapter } from '@/content/languages/chinese-adapter';
import { LanguageRegistry } from '@/content/languages/language-registry';
import {
  EnglishLanguageAdapter,
  FrenchLanguageAdapter,
  SpanishLanguageAdapter,
} from '@/content/languages/space-separated-adapter';

describe('LanguageRegistry — initial state', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it('starts with no adapters and no current language', () => {
    expect(registry.getAdapter()).toBeNull();
    expect(registry.getCurrentLanguage()).toBeNull();
    expect(registry.getAvailableLanguages()).toEqual([]);
    expect(registry.getAllAdapters().size).toBe(0);
  });

  it('reports no language as registered', () => {
    for (const code of ['zh', 'en', 'es', 'fr', 'de']) {
      expect(registry.hasLanguage(code)).toBe(false);
    }
  });

  it('delegates safely to a missing current adapter', () => {
    expect(registry.getDictionaryPath()).toBeNull();
    expect(registry.isTargetCharacter('中')).toBe(false);
    expect(registry.parseDictionary('anything')).toEqual({});
    expect(registry.getPronunciation('x', [])).toBeNull();
    expect(registry.getSentenceBoundary()).toBeNull();
    expect(registry.containsTargetLanguage('hello')).toBe(false);
  });

  it('extractWords resolves to an empty array with no current adapter', async () => {
    await expect(registry.extractWords('hello', {})).resolves.toEqual([]);
  });
});

describe('LanguageRegistry.setLanguage', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it.each([
    ['zh', ChineseLanguageAdapter, 'Chinese'],
    ['en', EnglishLanguageAdapter, 'English'],
    ['es', SpanishLanguageAdapter, 'Spanish'],
    ['fr', FrenchLanguageAdapter, 'French'],
  ])('lazily builds the %s adapter on first use', (code, ctor, name) => {
    expect(registry.hasLanguage(code)).toBe(false);
    expect(registry.setLanguage(code)).toBe(true);

    const adapter = registry.getAdapter();
    expect(adapter).toBeInstanceOf(ctor);
    expect(adapter?.getLanguageCode()).toBe(code);
    expect(adapter?.getConfig().name).toBe(name);
    expect(registry.getCurrentLanguage()).toBe(code);
    expect(registry.hasLanguage(code)).toBe(true);
  });

  it('reuses the same adapter instance on a second switch', () => {
    registry.setLanguage('en');
    const first = registry.getAdapter();
    registry.setLanguage('fr');
    registry.setLanguage('en');
    expect(registry.getAdapter()).toBe(first);
  });

  it('returns false for an unknown language code', () => {
    expect(registry.setLanguage('xx')).toBe(false);
    expect(registry.setLanguage('')).toBe(false);
    expect(registry.hasLanguage('xx')).toBe(false);
  });

  it('leaves the current language untouched when the switch fails', () => {
    registry.setLanguage('en');
    expect(registry.setLanguage('de')).toBe(false);
    expect(registry.getCurrentLanguage()).toBe('en');
    expect(registry.getAdapter()?.getLanguageCode()).toBe('en');
  });

  it('accumulates every language that has been selected', () => {
    for (const code of ['en', 'zh', 'es', 'fr']) {
      registry.setLanguage(code);
    }
    expect(registry.getAvailableLanguages().sort()).toEqual(['en', 'es', 'fr', 'zh']);
    expect(registry.getAllAdapters().size).toBe(4);
  });
});

describe('LanguageRegistry.initializeLanguageAdapter', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it.each(['zh', 'en', 'es', 'fr'])('initialises %s without making it current', code => {
    expect(registry.initializeLanguageAdapter(code)).toBe(true);
    expect(registry.hasLanguage(code)).toBe(true);
    expect(registry.getCurrentLanguage()).toBeNull();
    expect(registry.getAdapter()).toBeNull();
  });

  it('is idempotent', () => {
    registry.initializeLanguageAdapter('en');
    const adapter = registry.getAllAdapters().get('en');
    expect(registry.initializeLanguageAdapter('en')).toBe(true);
    expect(registry.getAllAdapters().get('en')).toBe(adapter);
  });

  it('returns false and warns for an unknown language code', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(registry.initializeLanguageAdapter('ja')).toBe(false);
    expect(warn).toHaveBeenCalledWith('Unknown language code: ja');
    expect(registry.hasLanguage('ja')).toBe(false);
  });
});

describe('LanguageRegistry.initializeDefaultAdapters', () => {
  it('registers all four supported languages at once', () => {
    const registry = new LanguageRegistry();
    registry.initializeDefaultAdapters();
    expect(registry.getAvailableLanguages()).toEqual(['zh', 'en', 'es', 'fr']);
    expect(registry.getCurrentLanguage()).toBeNull();
  });
});

describe('LanguageRegistry.register', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it('accepts an adapter under an arbitrary code', () => {
    const adapter = new EnglishLanguageAdapter();
    registry.register('en-GB', adapter);
    expect(registry.hasLanguage('en-GB')).toBe(true);
    expect(registry.getAllAdapters().get('en-GB')).toBe(adapter);
  });

  it('overwrites a previously registered adapter for the same code', () => {
    const first = new EnglishLanguageAdapter();
    const second = new EnglishLanguageAdapter();
    registry.register('en', first);
    registry.register('en', second);
    expect(registry.getAllAdapters().get('en')).toBe(second);
  });

  it('rejects anything without an isTargetCharacter method', () => {
    expect(() => registry.register('bad', {} as any)).toThrow(
      'Invalid adapter: must extend BaseLanguageAdapter'
    );
    expect(() => registry.register('bad', null as any)).toThrow(
      'Invalid adapter: must extend BaseLanguageAdapter'
    );
    expect(registry.hasLanguage('bad')).toBe(false);
  });
});

describe('LanguageRegistry.getAllAdapters', () => {
  it('returns a snapshot copy rather than the live map', () => {
    const registry = new LanguageRegistry();
    registry.setLanguage('en');
    const snapshot = registry.getAllAdapters();
    expect(snapshot).not.toBe(registry.adapters);

    snapshot.delete('en');
    expect(registry.hasLanguage('en')).toBe(true);

    registry.setLanguage('fr');
    expect(snapshot.has('fr')).toBe(false);
  });
});

describe('LanguageRegistry — per-language metadata lookups', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
    registry.initializeDefaultAdapters();
  });

  it('returns the config of a registered language', () => {
    expect(registry.getLanguageInfo('zh')?.displayName).toBe('Chinese (中文)');
    expect(registry.getLanguageInfo('fr')?.maxWordLength).toBe(25);
    expect(registry.getLanguageInfo('en')?.maxWordLength).toBe(45);
  });

  it('returns null for an unregistered language', () => {
    expect(registry.getLanguageInfo('de')).toBeNull();
  });

  it('reports scan resolution per language', () => {
    expect(registry.getScanResolution('zh')).toBe('char');
    expect(registry.getScanResolution('en')).toBe('word');
    expect(registry.getScanResolution('es')).toBe('word');
    expect(registry.getScanResolution('fr')).toBe('word');
    expect(registry.getScanResolution('de')).toBeNull();
  });

  it('reports case sensitivity per language', () => {
    expect(registry.getCaseSensitive('zh')).toBe(false);
    expect(registry.getCaseSensitive('en')).toBe(true);
    expect(registry.getCaseSensitive('es')).toBe(true);
    expect(registry.getCaseSensitive('fr')).toBe(true);
  });

  it('reports false for an unregistered language rather than null', () => {
    expect(registry.getCaseSensitive('de')).toBe(false);
  });

  it('lists language options sorted by display name', () => {
    expect(registry.getLanguageOptions()).toEqual([
      { code: 'zh', name: 'Chinese', displayName: 'Chinese (中文)' },
      { code: 'en', name: 'English', displayName: 'English' },
      { code: 'fr', name: 'French', displayName: 'French (Français)' },
      { code: 'es', name: 'Spanish', displayName: 'Spanish (Español)' },
    ]);
  });

  it('validates two-letter codes that are actually registered', () => {
    expect(registry.isValidLanguageCode('en')).toBe(true);
    expect(registry.isValidLanguageCode('zh')).toBe(true);
    expect(registry.isValidLanguageCode('de')).toBe(false); // valid shape, not registered
    expect(registry.isValidLanguageCode('eng')).toBe(false);
    expect(registry.isValidLanguageCode('')).toBe(false);
    expect(registry.isValidLanguageCode(null as any)).toBe(false);
  });
});

describe('LanguageRegistry — delegation to the current adapter', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it('delegates isTargetCharacter to the active language', () => {
    registry.setLanguage('zh');
    expect(registry.isTargetCharacter('中')).toBe(true);
    expect(registry.isTargetCharacter('a')).toBe(false);

    registry.setLanguage('en');
    expect(registry.isTargetCharacter('a')).toBe(true);
    expect(registry.isTargetCharacter('中')).toBe(false);
  });

  it('delegates containsTargetLanguage to the active language', () => {
    registry.setLanguage('zh');
    expect(registry.containsTargetLanguage('hello 中文')).toBe(true);
    registry.setLanguage('en');
    expect(registry.containsTargetLanguage('123 456')).toBe(false);
  });

  it('awaits the synchronous extractWords of a space-separated adapter', async () => {
    registry.setLanguage('en');
    await expect(registry.extractWords('hi there', { hi: [{}] })).resolves.toEqual([
      { word: 'hi', start: 0, end: 2, isTargetLang: true },
      { word: ' ', start: 2, end: 3, isTargetLang: false },
      { word: 'there', start: 3, end: 8, isTargetLang: false },
    ]);
  });

  it('awaits the asynchronous extractWords of the Chinese adapter', async () => {
    registry.setLanguage('zh');
    const adapter = registry.getAdapter() as ChineseLanguageAdapter;
    // Jieba never finishes loading under test; pin the fallback path explicitly.
    adapter.jieba = null;
    adapter.jiebaInitialized = false;

    await expect(registry.extractWords('中文', {})).resolves.toEqual([
      { word: '中', start: 0, end: 1, isTargetLang: true },
      { word: '文', start: 1, end: 2, isTargetLang: true },
    ]);
  });

  it('delegates the sentence boundary and dictionary path', () => {
    registry.setLanguage('en');
    expect(registry.getSentenceBoundary()?.source).toBe('(?<=[.!?])\\s+');
    expect(registry.getDictionaryPath()).toBe('dictionaries/English/ecdict.csv');

    registry.setLanguage('zh');
    expect(registry.getSentenceBoundary()?.source).toBe('(?<=[.!?。！？\\n])');
    expect(registry.getDictionaryPath()).toBeUndefined();
  });

  it('delegates getPronunciation to the active language', () => {
    registry.setLanguage('zh');
    expect(registry.getPronunciation('你好', [{ pinyin: 'nǐ hǎo' }])).toBe('nǐ hǎo');

    registry.setLanguage('en');
    expect(registry.getPronunciation('hello', [{ pronunciation: 'həˈləʊ' }])).toBe('həˈləʊ');
  });

  it('delegates parseDictionary to the active language', () => {
    registry.setLanguage('zh');
    const dictionary = registry.parseDictionary('你好 你好 [ni3 hao3] /hello/');
    expect(dictionary['你好']?.[0]?.pinyin).toBe('nǐ hǎo');
  });
});

describe('LanguageRegistry — events', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it('emits languageChanged with the previous and current language', () => {
    const seen: Array<{ previousLanguage: string | null; currentLanguage: string }> = [];
    registry.on('languageChanged', data => seen.push(data));

    registry.setLanguage('en');
    registry.setLanguage('fr');

    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ previousLanguage: null, currentLanguage: 'en' });
    expect(seen[1]).toMatchObject({ previousLanguage: 'en', currentLanguage: 'fr' });
  });

  it('includes the adapter instance in the event payload', () => {
    let payload: any = null;
    registry.on('languageChanged', data => {
      payload = data;
    });
    registry.setLanguage('es');
    expect(payload.adapter).toBe(registry.getAdapter());
  });

  it('does not emit when the switch fails', () => {
    const listener = vi.fn();
    registry.on('languageChanged', listener);
    registry.setLanguage('xx');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple listeners and removal via off', () => {
    const first = vi.fn();
    const second = vi.fn();
    registry.on('languageChanged', first);
    registry.on('languageChanged', second);

    registry.setLanguage('en');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    registry.off('languageChanged', first);
    registry.setLanguage('fr');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('off is a no-op for unknown events and unregistered callbacks', () => {
    expect(() => registry.off('nope', vi.fn())).not.toThrow();
    const listener = vi.fn();
    registry.on('languageChanged', listener);
    expect(() => registry.off('languageChanged', vi.fn())).not.toThrow();
    registry.setLanguage('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps notifying later listeners when one of them throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const survivor = vi.fn();
    registry.on('languageChanged', () => {
      throw new Error('listener blew up');
    });
    registry.on('languageChanged', survivor);

    expect(() => registry.setLanguage('en')).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
  });

  it('emit is a no-op when nobody is listening', () => {
    expect(() => registry.emit('languageChanged', { anything: true })).not.toThrow();
  });
});

describe('LanguageRegistry — adapter contract', () => {
  it('every built-in adapter satisfies the BaseLanguageAdapter surface used by the registry', () => {
    const registry = new LanguageRegistry();
    registry.initializeDefaultAdapters();

    for (const [code, adapter] of registry.getAllAdapters()) {
      const typed: BaseLanguageAdapter = adapter;
      expect(typeof typed.isTargetCharacter).toBe('function');
      expect(typed.getLanguageCode()).toBe(code);
      expect(typed.getConfig().characterRanges.length).toBeGreaterThan(0);
      expect(typed.getSentenceBoundary()).toBeInstanceOf(RegExp);
    }
  });
});
