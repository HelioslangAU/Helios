# Language Configuration Guide

## How to Add a New Language

This extension is designed to be modular and easy to extend with new languages. Follow these steps to add support for a new language:

### 1. Language Adapter
Create a new adapter in `src/content/languages/` if the language isn't space-separated.

**For space-separated languages (like German, Italian, etc):**
No new adapter needed! Just add configuration in step 2.

**For character-based languages (like Japanese, Korean):**
Create a new adapter extending `BaseLanguageAdapter`.

### 2. Register Language
Add to `src/content/languages/language-registry.js`:

```javascript
// In initializeDefaultAdapters()
this.registerLanguage('de', new SpaceSeparatedLanguageAdapter({
  code: 'de',
  name: 'German',
  nativeName: 'Deutsch',
  flag: '🇩🇪',
  scanResolution: 'word',
  maxWordLength: 25,
  description: 'Learn German vocabulary'
}));
```

### 3. Add Dictionary
Place dictionary file in `dictionaries/<language-code>/`:
```
dictionaries/
  ├── zh/
  ├── en/
  ├── fr/
  ├── es/
  └── de/  ← New language
      └── dictionary.json
```

**Dictionary Format:**
```json
{
  "word": [
    {
      "pinyin": "pronunciation" (optional),
      "english": "translation",
      "word": "word"
    }
  ]
}
```

### 4. Add Pronunciation Support
In `src/content/pronunciation.js`, update language maps:

```javascript
const languageMap = {
  'zh': 'zh-CN',
  'en': 'en-US',
  'fr': 'fr-FR',
  'es': 'es-ES',
  'de': 'de-DE'  ← Add this
};
```

And add voice selection:

```javascript
else if (language === 'de') {
  targetVoice = voices.find(
    (voice) =>
      voice.lang.startsWith("de") ||
      voice.name.toLowerCase().includes("german")
  );
}
```

### 5. Add to UI (Optional)
Update language selector in:
- `src/content/components/language-selector/language-selector.js`

That's it! The extension will automatically:
- ✅ Track known words separately for each language
- ✅ Track recent vocabulary separately
- ✅ Apply appropriate pronunciation
- ✅ Underline unknown words
- ✅ Show stats per language

## Current Supported Languages

| Code | Language | Dictionary | Pronunciation | Status |
|------|----------|-----------|---------------|--------|
| zh   | Chinese  | ✅        | ✅            | ✅     |
| en   | English  | ✅        | ✅            | ✅     |
| fr   | French   | ✅        | ✅            | ✅     |
| es   | Spanish  | ✅        | ✅            | ✅     |

## Adding More Space-Separated Languages

These languages can be added with minimal effort (just dictionary + config):

- German (de)
- Italian (it)
- Portuguese (pt)
- Dutch (nl)
- Russian (ru)
- Polish (pl)
- Swedish (sv)
- Norwegian (no)
- Danish (da)

## Storage Structure

Per-language data is stored as:
```javascript
{
  // Known words
  knownWordsByLanguage: {
    'zh': ['你好', '谢谢'],
    'fr': ['bonjour', 'merci'],
    'es': ['hola', 'gracias']
  },

  // Ignored words
  ignoredWordsByLanguage: {
    'zh': [...],
    'fr': [...],
    'es': [...]
  },

  // Recent vocabulary
  recentVocab_zh: [{word: '你好', definition: {...}, timestamp: 123...}],
  recentVocab_fr: [{word: 'bonjour', definition: {...}, timestamp: 123...}],
  recentVocab_es: [{word: 'hola', definition: {...}, timestamp: 123...}]
}
```

## Font Configuration

To add language-specific fonts, edit `src/ui/popup/popup.css`:

```css
.character.highlight.lang-german {
  font-family: "YourFont", sans-serif;
  font-size: 24px;
}
```

Then update `PopupContentBuilder.getLanguageClass()` to return the class.
