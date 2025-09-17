# Centralized File Paths Configuration

This extension now uses a centralized file paths configuration system. All file paths are defined in `src/config/paths.js` to make it easy to reorganize your file structure.

## How to Use

### 1. Accessing Paths in JavaScript

```javascript
// Get a specific path
const settingsUrl = window.PATHS.getChromeURL('HTML.HELIOS_SETTINGS');
const cssPath = window.PATHS.getPath('CSS.POPUP');

// Get Chrome runtime URL for any path
const dictionaryUrl = window.PATHS.getChromeURL('CEDICT');

// Get arrays of paths
const contentScripts = window.PATHS.getContentScripts();
const frequencyFiles = window.PATHS.getFrequencyFiles();
```

### 2. Available Path Categories

- **HTML files**: `HTML.HELIOS_SETTINGS`, `HTML.BANNER`, etc.
- **CSS files**: `CSS.POPUP`, `CSS.BANNER`, etc.
- **JavaScript modules**: `JS.HELIOS_SETTINGS`, `JS.VOCAB_MANAGER`, etc.
- **Icons**: `ICONS.ICON_16`, `ICONS.ICON_48`, etc.
- **Core files**: `CEDICT`, `BACKGROUND`, `MANIFEST`

### 3. Changing File Structure

When you want to reorganize your files:

1. **Update the paths in `src/config/paths.js`**
2. **Move your files to the new locations**
3. **All references throughout the codebase will automatically use the new paths**

### 4. Example: Moving Settings Files

If you want to move settings files from `src/settings/` to `src/modules/settings/`:

1. Update `src/config/paths.js`:
   ```javascript
   this.SETTINGS = 'src/modules/settings/';
   ```

2. Move the files:
   ```
   src/settings/ → src/modules/settings/
   ```

3. All references will automatically work!

### 5. Fallback System

The system includes fallbacks for backward compatibility:
```javascript
// This will use PATHS if available, otherwise fall back to hardcoded path
const url = window.PATHS ? window.PATHS.getChromeURL('HTML.HELIOS_SETTINGS') : chrome.runtime.getURL("src/ui/settings/helios-settings.html");
```

## Benefits

- ✅ **Single source of truth** for all file paths
- ✅ **Easy refactoring** - change structure in one place
- ✅ **Type safety** - consistent path references
- ✅ **Backward compatibility** - fallbacks for missing PATHS
- ✅ **Documentation** - clear overview of all file locations

## Files Updated

The following files have been updated to use the centralized paths:

- `src/frequency-manager.js`
- `src/dictionary-manager.js`
- `src/banner-manager.js`
- `src/settings/helios-settings.js`
- `src/extensiontab.js`
- `src/ui/settings/helios-settings.html`
- `manifest.json`

All other files can be updated as needed using the same pattern.
