import { afterAll, describe, it } from 'vitest';
import {
  EnglishLanguageAdapter,
  SpanishLanguageAdapter,
  FrenchLanguageAdapter,
  SpaceSeparatedLanguageAdapter,
} from '@/content/languages/space-separated-adapter';

const lines: string[] = [];
function show(label: string, out: any) {
  lines.push('### ' + label + ' => ' + JSON.stringify(out));
}
afterAll(async () => {
  const fs = await import('node:fs');
  fs.writeFileSync('/tmp/probe-out.txt', lines.join('\n'));
});

const en = new EnglishLanguageAdapter();
const es = new SpanishLanguageAdapter();
const fr = new FrenchLanguageAdapter();

describe('probe2', () => {
  it('misc', () => {
    show('caseSensitive', [en.getCaseSensitive(), es.getCaseSensitive(), fr.getCaseSensitive()]);
    show('normalizeWord en', [en.normalizeWord('  CAFÉ '), en.normalizeWord(''), en.normalizeWord(null as any), en.normalizeWord('Café')]);
    show('normalizeWord fr', [fr.normalizeWord('  L\'EAU '), fr.normalizeWord(''), fr.normalizeWord(undefined as any)]);
    show('nfc equal', en.normalizeWord('café') === 'café');
    show('scanResolution', [en.getScanResolution(), es.getScanResolution()]);
    show('displayNames', [en.getDisplayName(), es.getDisplayName(), fr.getDisplayName()]);
    show('dictPaths', [en.getDictionaryPath(), es.getDictionaryPath(), fr.getDictionaryPath()]);
    show('onboardingVocab', [en.getOnboardingVocabPath('A1'), es.getOnboardingVocabPath('A1'), fr.getOnboardingVocabPath('A1')]);
    show('downloadUrl', [en.getDictionaryDownloadUrl(), es.getDictionaryDownloadUrl('es')]);
    show('isTargetCharacter en', ['a', 'Z', 'é', 'ñ', 'ü', 'ç', 'ā', 'ǔ', '1', ' ', '-', '中', ''].map(c => [c, en.isTargetCharacter(c)]));
    show('isTargetCharacter es 0x0180', [es.isTargetCharacter('ƀ'), en.isTargetCharacter('ƀ'), es.isTargetCharacter('ſ'), es.isTargetCharacter('ɏ'), en.isTargetCharacter('ɏ'), en.isTargetCharacter('ɐ')]);
    show('containsTargetLanguage', [en.containsTargetLanguage('123 abc'), en.containsTargetLanguage('123 !!'), en.containsTargetLanguage('')]);
    show('isValidWord', [en.isValidWord('Hello', { hello: [1] }), en.isValidWord('Hello', {}), en.isValidWord('', { '': [1] }), en.isValidWord('x', null)]);
    show('fr isValidWord', [fr.isValidWord("l'eau", { eau: [{}] }), fr.isValidWord('xyz', {})]);

    // findDictionaryForm base + mapping branch
    const mapDict: any = { 'gato': [{ definition: 'cat' }], 'gatos': [[0, 0, 0, 0, 0, [['gato', ['plural']]]]] };
    show('es findDictionaryForm gatos (mapping)', es.findDictionaryForm('gatos', mapDict));
    show('es findDictionaryForm gato', es.findDictionaryForm('gato', mapDict));
    show('es findDictionaryForm missing', es.findDictionaryForm('perro', mapDict));
    const emptyArrDict: any = { 'gatos': [] };
    show('es findDictionaryForm empty-array entry', es.findDictionaryForm('gatos', emptyArrDict));
    show('fr findDictionaryForm mapping', fr.findDictionaryForm('gatos', mapDict));

    show('fr contraction uppercase', fr.findDictionaryForm("L'eau", { eau: [{}] }));
    show('fr contraction cap base', fr.findDictionaryForm("L'Eau", { Eau: [{}] }));
    show('fr contraction j', fr.findDictionaryForm("j'aime", { aime: [{}] }));
    show('fr contraction accented base', fr.findDictionaryForm("l'été", { 'été': [{}] }));
    show('fr contraction unknown base', fr.findDictionaryForm("z'xyz", {}));

    show('getDictionaryEntries en direct', en.getDictionaryEntries('Hello', { hello: [{ definition: 'hi' }] }));
    show('getDictionaryEntries en nfd', en.getDictionaryEntries('Café', { 'café': [{ definition: 'coffee' }] }));
    show('getDictionaryEntries en missing', en.getDictionaryEntries('nope', { hello: [{}] }));
    show('getDictionaryEntries en null', [en.getDictionaryEntries('', {}), en.getDictionaryEntries('a', null)]);
    show('getDictionaryEntries fr contraction', fr.getDictionaryEntries("l'eau", { eau: [{ definition: 'water', translation: 'water' }] }));
    show('getDictionaryEntries fr direct', fr.getDictionaryEntries("d'accord", { "d'accord": [{ definition: 'ok' }] }));

    // extra extractWords edges
    show('EN dict hit', en.extractWords('The cat sat', { the: [1], cat: [1] }));
    show("EN 'tis", en.extractWords("'tis the season", {}));
    show('EN trailing hyphen', en.extractWords('well- known', {}));
    show('EN leading space', en.extractWords('  hi', {}));
    show('EN newline', en.extractWords('a\nb', {}));
    show('ES accents dict', es.extractWords('El niño come', { el: [{}], 'niño': [{}] }));
    show('ES curly quote whole', es.extractWords('¡Hola, señor!', {}));
    show('FR elisions', fr.extractWords("L'eau, c'est bon", { eau: [{}], est: [{}], bon: [{}] }));
    show('FR qu il', fr.extractWords("qu'il pleut", { il: [{}], pleut: [{}] }));
    show('FR hyphen all found', fr.extractWords('Est-ce', { est: [{}], ce: [{}] }));
    show('FR hyphen trailing', fr.extractWords('vas-y-', { vas: [{}] }));
    show('FR multi hyphen', fr.extractWords('arc-en-ciel', { arc: [{}], en: [{}], ciel: [{}] }));

    // parseCSVLine + English parseDictionary
    show('parseCSVLine simple', en.parseCSVLine('a,b,c'));
    show('parseCSVLine quoted', en.parseCSVLine('word,"pho, netic",def,trans'));
    show('parseCSVLine empty', en.parseCSVLine(''));
    const csv = [
      'word,phonetic,definition,translation,pos,collins,oxford,tag,bnc,frq,exchange,detail,audio',
      'hello,həˈləʊ,"int. used as a greeting",int. 喂\\n int. 哈罗,int/1,3,1,zk gk,1234,567,,,',
      'bad line',
      ",,,,",
      'cat,kæt,n. a small animal,n. 猫,n/1,5,1,zk,10,20,s:cats,,',
    ].join('\n');
    show('en parseDictionary', en.parseDictionary(csv));
    show('en parseDictionary empty', en.parseDictionary(''));
    show('es parseDictionary no banks', es.parseDictionary('garbage'));
    show('fr parseDictionary bank listing', fr.parseDictionary('term_bank_1.json\nterm_bank_2.json'));

    // getPronunciation
    show('getPronunciation', [
      en.getPronunciation('x', [{ pronunciation: 'p' }]),
      en.getPronunciation('x', [{ ipa: 'i' }]),
      en.getPronunciation('x', [{ phonetic: 'f' }]),
      en.getPronunciation('x', [{}]),
      en.getPronunciation('x', []),
    ]);
    show('getSentenceBoundary', [en.getSentenceBoundary().source, 'The cat sat. It ran! Why? Yes'.split(en.getSentenceBoundary())]);

    // processTermBank
    const adapter = new SpaceSeparatedLanguageAdapter({} as any);
    const dict: any = {};
    const lemmaEntry = [
      'hablar', 'hablar', 'lemma', 'v', 100,
      [{
        type: 'structured-content',
        content: [
          {
            content: [
              { data: { content: 'details-entry-Grammar' }, content: [{ data: { content: 'Grammar-content' }, content: 'verb, first conjugation' }] },
              { data: { content: 'details-entry-Morphemes' }, content: [{ data: { content: 'Morphemes-content' }, content: 'habl- + -ar' }] },
            ],
          },
          {
            data: { content: 'glosses' },
            content: [
              { content: [{ content: ['to speak', ' ', 'to talk'] }] },
              { content: [{ content: 'to say' }] },
            ],
          },
        ],
      }],
    ];
    show('processTermBank lemma', adapter.processTermBank([lemmaEntry], dict));
    show('dict after lemma', dict);
    const nonLemma = ['hablo', 'hablo', 'non-lemma', 'v', 10, [[ 'hablar', ['first-person singular present'] ]]];
    show('processTermBank non-lemma', adapter.processTermBank([nonLemma], dict));
    show('dict after non-lemma', dict);
    show('processTermBank dup', adapter.processTermBank([lemmaEntry], dict));
    show('processTermBank junk', [adapter.processTermBank('nope' as any, {}), adapter.processTermBank([[1, 2]], {}), adapter.processTermBank([[null, 1, 2, 3, 4, 5]], {})]);
  });
});
