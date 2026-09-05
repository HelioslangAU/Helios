import { describe, expect, it } from 'vitest';
import { BaseLanguageAdapter } from '@/content/languages/base-language-adapter';
import type { LanguageConfig } from '@/content/languages/base-language-adapter';

const VALID_CONFIG: LanguageConfig = {
  code: 'xx',
  name: 'Testish',
  displayName: 'Testish (Test)',
  maxWordLength: 20,
  hasSpaces: true,
  script: 'latin',
  direction: 'ltr',
  scanResolution: 'word',
  caseSensitive: false,
  characterRanges: [{ start: 0x0041, end: 0x005a }],
  wordBoundaryRegex: /\b/,
  sentenceBoundaryRegex: /(?<=[.!?])\s+/,
};

/** Minimal concrete adapter: BaseLanguageAdapter refuses to be instantiated directly. */
class TestAdapter extends BaseLanguageAdapter {
  constructor(config: LanguageConfig = VALID_CONFIG) {
    super();
    this.setConfig(config);
  }

  // Only A-Z counts, so containsTargetLanguage has something deterministic to chew on.
  override isTargetCharacter(char: string): boolean {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return code >= 0x0041 && code <= 0x005a;
  }
}

/** Subclass that never calls setConfig, for the "configuration not set" paths. */
class UnconfiguredAdapter extends BaseLanguageAdapter {}

describe('BaseLanguageAdapter — instantiation and config validation', () => {
  it('refuses to be instantiated directly', () => {
    expect(() => new (BaseLanguageAdapter as any)()).toThrow(
      'BaseLanguageAdapter is abstract and cannot be instantiated directly'
    );
  });

  it('allows a subclass to be instantiated', () => {
    expect(() => new TestAdapter()).not.toThrow();
  });

  it('setConfig stores a copy of the config rather than the caller object', () => {
    const config = { ...VALID_CONFIG };
    const adapter = new TestAdapter(config);
    expect(adapter.getConfig()).toEqual(config);
    expect(adapter.getConfig()).not.toBe(config);
  });

  it('validateConfig rejects a config missing a required property', () => {
    const adapter = new TestAdapter();
    expect(() => adapter.validateConfig({})).toThrow('Missing required config property: code');
  });

  it('validateConfig reports the first missing property by name', () => {
    const adapter = new TestAdapter();
    const { displayName, ...withoutDisplayName } = VALID_CONFIG;
    expect(() => adapter.validateConfig(withoutDisplayName)).toThrow(
      'Missing required config property: displayName'
    );
  });

  it('validateConfig rejects a string where a number is required', () => {
    const adapter = new TestAdapter();
    expect(() => adapter.validateConfig({ ...VALID_CONFIG, maxWordLength: '20' })).toThrow(
      'maxWordLength must be a number'
    );
  });

  it('validateConfig rejects a non-boolean hasSpaces', () => {
    const adapter = new TestAdapter();
    expect(() => adapter.validateConfig({ ...VALID_CONFIG, hasSpaces: 'yes' })).toThrow(
      'hasSpaces must be a boolean'
    );
  });

  it('validateConfig rejects a non-array characterRanges', () => {
    const adapter = new TestAdapter();
    expect(() => adapter.validateConfig({ ...VALID_CONFIG, characterRanges: {} })).toThrow(
      'characterRanges must be an array'
    );
  });

  it('validateConfig rejects a string where a RegExp is required', () => {
    const adapter = new TestAdapter();
    expect(() => adapter.validateConfig({ ...VALID_CONFIG, wordBoundaryRegex: '\\b' })).toThrow(
      'wordBoundaryRegex must be a RegExp'
    );
  });

  it('validateConfig rejects a non-string code', () => {
    const adapter = new TestAdapter();
    expect(() => adapter.validateConfig({ ...VALID_CONFIG, code: 42 })).toThrow('code must be a string');
  });

  it('getConfig throws when setConfig was never called', () => {
    const adapter = new UnconfiguredAdapter();
    expect(() => adapter.getConfig()).toThrow(
      'Configuration not set. Call setConfig in your language adapter constructor.'
    );
  });
});

describe('BaseLanguageAdapter — unimplemented abstract methods', () => {
  const adapter = new UnconfiguredAdapter();

  it('isTargetCharacter throws', () => {
    expect(() => adapter.isTargetCharacter('a')).toThrow(
      'isTargetCharacter() must be implemented by language adapter'
    );
  });

  it('extractWords throws', () => {
    expect(() => adapter.extractWords('a', {})).toThrow(
      'extractWords() must be implemented by language adapter'
    );
  });

  it('parseDictionary throws', () => {
    expect(() => adapter.parseDictionary('a')).toThrow(
      'parseDictionary() must be implemented by language adapter'
    );
  });

  it('getPronunciation throws', () => {
    expect(() => adapter.getPronunciation('a', [])).toThrow(
      'getPronunciation() must be implemented by language adapter'
    );
  });

  it('getSentenceBoundary throws', () => {
    expect(() => adapter.getSentenceBoundary()).toThrow(
      'getSentenceBoundary() must be implemented by language adapter'
    );
  });
});

describe('BaseLanguageAdapter — config accessors', () => {
  const adapter = new TestAdapter();

  it('exposes scan resolution, case sensitivity, name and code from the config', () => {
    expect(adapter.getScanResolution()).toBe('word');
    expect(adapter.getCaseSensitive()).toBe(false);
    expect(adapter.getDisplayName()).toBe('Testish');
    expect(adapter.getLanguageCode()).toBe('xx');
  });

  it('getDisplayName returns config.name, not config.displayName', () => {
    // BUG: getDisplayName() returns `name` ("Testish") while the config also carries a
    // dedicated `displayName` ("Testish (Test)"). Reads like a naming mix-up, but the
    // registry's getLanguageOptions() is what actually surfaces displayName in the UI.
    expect(adapter.getDisplayName()).toBe(VALID_CONFIG.name);
    expect(adapter.getDisplayName()).not.toBe(VALID_CONFIG.displayName);
  });

  it('builds the default dictionary path from the language code', () => {
    expect(adapter.getDictionaryPath()).toBe('dictionaries/xx-dict.json');
  });

  it('builds the dictionary download URL, defaulting the native language to en', () => {
    expect(adapter.getDictionaryDownloadUrl()).toBe(
      'https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-xx-en.zip'
    );
    expect(adapter.getDictionaryDownloadUrl('fr')).toBe(
      'https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-xx-fr.zip'
    );
    expect(adapter.getDictionaryDownloadUrl(null)).toBe(
      'https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-xx-en.zip'
    );
  });

  it('has no level definitions or onboarding vocab path by default', () => {
    expect(adapter.getLevelDefinitions()).toEqual([]);
    expect(adapter.getOnboardingVocabPath('A1')).toBeNull();
  });
});

describe('BaseLanguageAdapter — containsTargetLanguage / isValidWord', () => {
  const adapter = new TestAdapter();

  it('detects at least one target character anywhere in the text', () => {
    expect(adapter.containsTargetLanguage('123 A 456')).toBe(true);
    expect(adapter.containsTargetLanguage('A')).toBe(true);
  });

  it('returns false when no character is in range', () => {
    expect(adapter.containsTargetLanguage('abc 123 !!')).toBe(false);
  });

  it('returns false for empty text', () => {
    expect(adapter.containsTargetLanguage('')).toBe(false);
  });

  it('isValidWord is true only when the dictionary holds a non-empty entry list', () => {
    expect(adapter.isValidWord('cat', { cat: [{ definition: 'a small animal' }] })).toBe(true);
    expect(adapter.isValidWord('cat', { cat: [] })).toBe(false);
  });

  it('isValidWord returns a falsy non-boolean when the word is absent', () => {
    // BUG: declared to return boolean, but `dictionary[word] && ...` short-circuits to
    // undefined for a missing key (and to null when dictionary is null).
    expect(adapter.isValidWord('cat', {})).toBeUndefined();
    expect(adapter.isValidWord('cat', null)).toBeNull();
  });
});

describe('BaseLanguageAdapter.detectVariantPattern — CEDICT-style variant definitions', () => {
  const adapter = new TestAdapter();

  it('detects "erhua variant of" and splits the traditional|simplified pair', () => {
    expect(adapter.detectVariantPattern('erhua variant of 等一會|等一会[deng3 yi1 hui4]')).toEqual({
      pattern: 'erhua\\s+variant\\s+of\\s+(.+?)(?:\\s*\\[|;|$)',
      baseWords: ['等一會', '等一会'],
      fullMatch: 'erhua variant of 等一會|等一会[',
    });
  });

  it('detects "erhua form of"', () => {
    const result = adapter.detectVariantPattern('erhua form of 哪兒|哪儿[na3 r5]');
    expect(result?.pattern).toBe('erhua\\s+form\\s+of\\s+(.+?)(?:\\s*\\[|;|$)');
    expect(result?.baseWords).toEqual(['哪兒', '哪儿']);
  });

  it('detects a plain "variant of"', () => {
    const result = adapter.detectVariantPattern('variant of 說|说[shuo1]');
    expect(result?.pattern).toBe('variant\\s+of\\s+(.+?)(?:\\s*\\[|;|$)');
    expect(result?.baseWords).toEqual(['說', '说']);
    expect(result?.fullMatch).toBe('variant of 說|说[');
  });

  it.each([
    ['old variant of 才[cai2]', ['才']],
    ['archaic variant of 慚|惭[can2]', ['慚', '惭']],
    ['ancient variant of 逸[yi4]', ['逸']],
    ['obsolete variant of 徽[hui1]', ['徽']],
    ['classical variant of 疏[shu1]', ['疏']],
  ])('extracts the base word from %j', (definition, expected) => {
    const result = adapter.detectVariantPattern(definition);
    expect(result?.baseWords).toEqual(expected);
    // BUG: the qualified patterns (old/archaic/ancient/obsolete/classical variant of) are
    // listed AFTER the generic /variant\s+of/ pattern, so the generic one always wins and
    // the qualifier-specific entries in variantPatterns are unreachable.
    expect(result?.pattern).toBe('variant\\s+of\\s+(.+?)(?:\\s*\\[|;|$)');
  });

  it.each([
    ['nonstandard spelling of 麼|么[me5]', ['麼', '么']],
    ['standard spelling of 太[tai4]', ['太']],
    ['standard variant of 群[qun2]', ['群']],
  ])('detects the standard-spelling family: %j', (definition, expected) => {
    const result = adapter.detectVariantPattern(definition);
    expect(result?.pattern).toBe('(?:non\\s*)?standard\\s*(?:spelling|variant)\\s+of\\s+(.+?)(?:\\s*\\[|;|$)');
    expect(result?.baseWords).toEqual(expected);
  });

  it('matches hyphenated "non-standard" only from "standard" onwards', () => {
    // The `non\s*` prefix allows whitespace but not a hyphen, so the match starts mid-phrase.
    const result = adapter.detectVariantPattern('non-standard spelling of 甚麼|什么');
    expect(result?.fullMatch).toBe('standard spelling of 甚麼|什么');
    expect(result?.baseWords).toEqual(['甚麼', '什么']);
  });

  it.each([
    ['alternative spelling of colour', 'alternative\\s+spelling\\s+of\\s+(.+?)(?:\\s*\\[|;|$)', ['colour']],
    ['alternate spelling of gray', 'alternate\\s+spelling\\s+of\\s+(.+?)(?:\\s*\\[|;|$)', ['gray']],
  ])('detects Latin-script alternative spellings: %j', (definition, pattern, expected) => {
    const result = adapter.detectVariantPattern(definition);
    expect(result?.pattern).toBe(pattern);
    expect(result?.baseWords).toEqual(expected);
  });

  it('detects "see also:" cross-references', () => {
    const result = adapter.detectVariantPattern('see also: 傻瓜[sha3 gua1]');
    expect(result?.pattern).toBe('see\\s+also\\s*[:：]?\\s*(.+?)(?:\\s*\\[|;|$)');
    expect(result?.baseWords).toEqual(['傻瓜']);
  });

  it('detects a bare "see" cross-reference', () => {
    const result = adapter.detectVariantPattern('see 上邊|上边[shang4 bian5]');
    expect(result?.pattern).toBe('see\\s*[:：]?\\s*(.+?)(?:\\s*\\[|;|$)');
    expect(result?.baseWords).toEqual(['上邊', '上边']);
  });

  it('misfires on ordinary definitions containing the word "see"', () => {
    // BUG: /see\s*[:：]?\s*(.+?)(?:\s*\[|;|$)/ is unanchored, so any definition that merely
    // contains "see" is treated as a cross-reference. "to see the doctor" resolves to a
    // bogus base word "the doctor". Expected: only leading "see"/"see also" references.
    expect(adapter.detectVariantPattern('to see the doctor')).toEqual({
      pattern: 'see\\s*[:：]?\\s*(.+?)(?:\\s*\\[|;|$)',
      baseWords: ['the doctor'],
      fullMatch: 'see the doctor',
    });
  });

  it('is case-insensitive', () => {
    expect(adapter.detectVariantPattern('Variant Of 說')?.baseWords).toEqual(['說']);
  });

  it('stops the base word at the first semicolon', () => {
    expect(adapter.detectVariantPattern('variant of 广; wide')?.baseWords).toEqual(['广']);
  });

  it('returns null for ordinary definitions', () => {
    expect(adapter.detectVariantPattern('water; H2O')).toBeNull();
    expect(adapter.detectVariantPattern('CL:個|个[ge4]')).toBeNull();
  });

  it('returns null for empty / non-string input', () => {
    expect(adapter.detectVariantPattern('')).toBeNull();
    expect(adapter.detectVariantPattern(null as any)).toBeNull();
    expect(adapter.detectVariantPattern(undefined as any)).toBeNull();
    expect(adapter.detectVariantPattern(123 as any)).toBeNull();
  });
});

describe('BaseLanguageAdapter.extractBaseWords', () => {
  const adapter = new TestAdapter();

  it('splits a traditional|simplified pair and strips the pinyin bracket', () => {
    expect(adapter.extractBaseWords('等一會|等一会[deng3 yi1 hui4]')).toEqual(['等一會', '等一会']);
  });

  it('splits a traditional|simplified pair without pinyin', () => {
    expect(adapter.extractBaseWords('等一會|等一会')).toEqual(['等一會', '等一会']);
  });

  it('drops empty segments produced by consecutive pipes', () => {
    expect(adapter.extractBaseWords('說||说')).toEqual(['說', '说']);
  });

  it('strips a bracketed pronunciation from a single Latin word', () => {
    expect(adapter.extractBaseWords('colour [ˈkʌlə]')).toEqual(['colour']);
  });

  it('returns a single-element array for a plain word', () => {
    expect(adapter.extractBaseWords('plain')).toEqual(['plain']);
  });

  it('returns an empty array for empty, whitespace-only, or bracket-only text', () => {
    expect(adapter.extractBaseWords('')).toEqual([]);
    expect(adapter.extractBaseWords('   ')).toEqual([]);
    expect(adapter.extractBaseWords('[deng3 yi1 hui4]')).toEqual([]);
  });
});

describe('BaseLanguageAdapter.getDefinitionParts', () => {
  const adapter = new TestAdapter();

  it('splits a CEDICT definition on semicolons and trims each part', () => {
    expect(adapter.getDefinitionParts('to speak; to say; to explain')).toEqual([
      'to speak',
      'to say',
      'to explain',
    ]);
  });

  it('splits on the newline-semicolon separator used by enhanceVariantDefinition', () => {
    expect(adapter.getDefinitionParts('variant of 說\n;to speak; to say')).toEqual([
      'variant of 說',
      'to speak',
      'to say',
    ]);
  });

  it('drops empty parts', () => {
    expect(adapter.getDefinitionParts('a;;b')).toEqual(['a', 'b']);
    expect(adapter.getDefinitionParts(' ; ; ')).toEqual([]);
  });

  it('returns a single part when there is no separator', () => {
    expect(adapter.getDefinitionParts('hello')).toEqual(['hello']);
  });

  it('returns an empty array for empty / non-string input', () => {
    expect(adapter.getDefinitionParts('')).toEqual([]);
    expect(adapter.getDefinitionParts(null as any)).toEqual([]);
    expect(adapter.getDefinitionParts(42 as any)).toEqual([]);
  });
});

describe('BaseLanguageAdapter.extractBaseDefinition', () => {
  const adapter = new TestAdapter();

  it('skips variant entries and joins the remaining definitions', () => {
    expect(
      adapter.extractBaseDefinition([
        { definition: 'variant of 說|说[shuo1]' },
        { definition: 'to speak; to say' },
        { definition: 'to say; to explain' },
      ])
    ).toBe('to speak; to say; to explain');
  });

  it('falls back to variant entries when nothing else is available', () => {
    expect(adapter.extractBaseDefinition([{ definition: 'variant of 說' }])).toBe('variant of 說');
  });

  it('ignores entries without a definition', () => {
    expect(adapter.extractBaseDefinition([{ pinyin: 'shuo1' }, { definition: 'to speak' }])).toBe(
      'to speak'
    );
  });

  it('returns null for an empty or nullish entry list', () => {
    expect(adapter.extractBaseDefinition([])).toBeNull();
    expect(adapter.extractBaseDefinition(null as any)).toBeNull();
  });
});

describe('BaseLanguageAdapter.enhanceVariantDefinition', () => {
  const adapter = new TestAdapter();

  it('appends the base word definition after a newline-semicolon', async () => {
    const dictionary: Record<string, any[]> = { '说': [{ definition: 'to speak; to say' }] };
    await expect(adapter.enhanceVariantDefinition('variant of 說|说[shuo1]', dictionary)).resolves.toBe(
      'variant of 說|说[shuo1]\n;to speak; to say'
    );
  });

  it('leaves non-variant definitions untouched', async () => {
    await expect(adapter.enhanceVariantDefinition('water; H2O', {})).resolves.toBe('water; H2O');
  });

  it('returns the original definition when the base word is not in the dictionary', async () => {
    await expect(adapter.enhanceVariantDefinition('variant of 龘', {})).resolves.toBe('variant of 龘');
  });

  it('returns falsy input unchanged without touching the dictionary', async () => {
    await expect(adapter.enhanceVariantDefinition('', {})).resolves.toBe('');
  });

  it('does not append definition parts the word already has', async () => {
    const dictionary: Record<string, any[]> = { '说': [{ definition: 'variant of 說|说[shuo1]' }] };
    await expect(adapter.enhanceVariantDefinition('variant of 說|说[shuo1]', dictionary)).resolves.toBe(
      'variant of 說|说[shuo1]'
    );
  });

  it('does not append parts already present in another entry for the same word', async () => {
    const dictionary: Record<string, any[]> = { '管': [{ definition: 'to manage' }] };
    const allEntriesForWord = [{ definition: 'to manage' }];
    await expect(
      adapter.enhanceVariantDefinition('variant of 管[guan3]', dictionary, null, allEntriesForWord)
    ).resolves.toBe('variant of 管[guan3]');
  });

  it('falls back to the async lookup and caches the result in the dictionary', async () => {
    const dictionary: Record<string, any[]> = {};
    const looked: string[] = [];
    const getDefinitionAsync = async (word: string) => {
      looked.push(word);
      return [{ definition: 'dragon' }];
    };

    await expect(
      adapter.enhanceVariantDefinition('variant of 龍', dictionary, getDefinitionAsync)
    ).resolves.toBe('variant of 龍\n;dragon');
    expect(looked).toEqual(['龍']);
    expect(dictionary['龍']).toEqual([{ definition: 'dragon' }]);
  });

  it('lowercases the base word for the dictionary lookup when the language is case-insensitive', async () => {
    // config.caseSensitive === false, so "Colour" is looked up as "colour".
    const dictionary: Record<string, any[]> = { colour: [{ definition: 'a hue' }] };
    await expect(
      adapter.enhanceVariantDefinition('alternative spelling of Colour', dictionary)
    ).resolves.toBe('alternative spelling of Colour\n;a hue');
  });

  it('survives a rejecting async lookup and returns the original definition', async () => {
    const failing = async () => {
      throw new Error('offscreen document unavailable');
    };
    await expect(adapter.enhanceVariantDefinition('variant of 龍', {}, failing)).resolves.toBe(
      'variant of 龍'
    );
  });

  it('tries each base word of a traditional|simplified pair in order', async () => {
    const dictionary: Record<string, any[]> = { '说': [{ definition: 'to speak' }] };
    // 說 (traditional) is absent, 说 (simplified) resolves.
    await expect(adapter.enhanceVariantDefinition('variant of 說|说', dictionary)).resolves.toBe(
      'variant of 說|说\n;to speak'
    );
  });
});
