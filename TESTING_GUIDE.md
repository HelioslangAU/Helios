# Language Selection Testing Guide

## Quick Fix Summary

I've fixed the critical bug where `targetLanguage` wasn't being loaded by the background script. The extension should now work correctly!

## How to Test

### Step 1: Reload the Extension
1. Open `chrome://extensions`
2. Find "Helios" extension
3. Click the **reload** icon (circular arrow)
4. Check for any errors in the extension

### Step 2: Reset Onboarding (to test fresh install)
1. Open DevTools Console (F12) on any webpage
2. Paste and run:
```javascript
chrome.storage.local.remove(['hasCompletedOnboarding', 'installDate'], () => {
  console.log('✅ Onboarding reset - you can now test first install');
});
```
3. Reload the extension again from `chrome://extensions`
4. Onboarding page should open automatically

### Step 3: Complete Onboarding
1. Click "Get Started" on welcome screen
2. Select a language (e.g., **Spanish**)
3. Click "Complete Setup"
4. You should see the success screen

### Step 4: Test on a Real Page
1. Close the onboarding tab
2. Navigate to a webpage in your target language:
   - **Spanish**: https://es.wikipedia.org or https://elpais.com
   - **French**: https://fr.wikipedia.org or https://lemonde.fr
   - **English**: https://en.wikipedia.org or any English site
   - **Chinese**: https://zh.wikipedia.org or https://baidu.com

3. Open DevTools Console (F12) and check the logs:
   - Look for: `🌍 Loading extension with target language: es`
   - Look for: `📚 Loading dictionary for language: es`
   - Look for: `✅ Dictionary and resources loaded successfully`

4. **Hold Shift** and hover over words - you should see:
   - Underlines appear on unknown words
   - A popup with definitions when you hover

### Step 5: Check What's Stored
Open DevTools console and run:
```javascript
chrome.storage.local.get(null, (data) => {
  console.log('📦 All stored data:', data);
  console.log('🌍 Target language:', data.targetLanguage);
  console.log('✅ Onboarding complete:', data.hasCompletedOnboarding);
});
```

You should see:
- `targetLanguage: "es"` (or whatever you selected)
- `hasCompletedOnboarding: true`

## Debugging Steps

### If Underlining Doesn't Work:

1. **Check Console Logs**
   - Open DevTools (F12) on the webpage
   - Look for errors (red text)
   - Check if dictionary loaded successfully

2. **Verify Extension is Enabled**
   - Click the Helios icon in toolbar
   - Make sure the toggle is ON (sunrise, not sunset)

3. **Check Language is Correct**
   ```javascript
   // In DevTools console:
   window.languageRegistry.getCurrentLanguage()
   // Should return: 'es', 'fr', 'en', or 'zh'
   ```

4. **Check Dictionary Loaded**
   ```javascript
   // In DevTools console:
   window.dictionaryManager.dictionary
   // Should show a large object with words
   ```

5. **Manually Trigger Processing**
   ```javascript
   // In DevTools console:
   window.pageProcessor.processPage()
   // This should underline words on the page
   ```

### If Onboarding Doesn't Show:

1. **Check if already completed:**
   ```javascript
   chrome.storage.local.get('hasCompletedOnboarding', (r) => {
     console.log('Already completed?', r.hasCompletedOnboarding);
   });
   ```

2. **Reset and try again:**
   ```javascript
   chrome.storage.local.remove(['hasCompletedOnboarding', 'installDate']);
   ```
   Then reload extension.

### If Language Switching Doesn't Work:

1. Go to Settings (click Helios icon → Settings)
2. Change language in dropdown
3. Watch DevTools console for:
   - `🔄 Language change requested: [code]`
   - Loading notification should appear on page
   - Success notification should follow

4. If no messages appear, the settings UI might not be sending the message correctly.

## Test Language Switching

After onboarding, test switching between all 4 languages:

1. **English → Spanish:**
   ```javascript
   window.languageSwitchCoordinator.switchLanguage('es')
   ```
   - Should see loading notification
   - Should see success: "✓ Switched to Spanish"
   - Visit https://elpais.com and verify underlines work

2. **Spanish → French:**
   ```javascript
   window.languageSwitchCoordinator.switchLanguage('fr')
   ```
   - Visit https://lemonde.fr and test

3. **French → Chinese:**
   ```javascript
   window.languageSwitchCoordinator.switchLanguage('zh')
   ```
   - Visit https://baidu.com and test

4. **Chinese → English:**
   ```javascript
   window.languageSwitchCoordinator.switchLanguage('en')
   ```
   - Visit https://en.wikipedia.org and test

## Common Issues

### Issue: "No underlines appear"
**Causes:**
- Dictionary not loaded
- Wrong language selected
- Extension disabled
- Page loaded before extension initialized

**Solutions:**
- Refresh the page
- Check console for errors
- Verify `targetLanguage` in storage
- Manually run: `window.pageProcessor.processPage()`

### Issue: "Can't see popup on hover"
**Causes:**
- Not holding Shift key
- Hovering over known words
- Activation key changed in settings

**Solutions:**
- Make sure you're holding Shift (or check Settings → Activation Key)
- Try different words
- Click a word to mark it as unknown, then hover again

### Issue: "Wrong language dictionary loads"
**Causes:**
- `targetLanguage` not saved properly
- Background script not updated
- Cache issue

**Solutions:**
- Check storage: `chrome.storage.local.get('targetLanguage', console.log)`
- Reload extension completely
- Clear extension data and redo onboarding

## Expected Console Output

When everything works correctly, you should see:

```
🔍 Initializing Language Learning Extension...
🌍 Loading extension with target language: es
📋 All settings received: {targetLanguage: "es", extensionEnabled: true, ...}
📚 Loading dictionary for language: es
✅ Dictionary and resources loaded successfully
🔍 Language Learning Extension initialized successfully
```

## Quick Verification Commands

Paste these in DevTools console to verify everything:

```javascript
// 1. Check current language
console.log('Current language:', window.languageRegistry.getCurrentLanguage());

// 2. Check available languages
console.log('Available:', window.languageRegistry.getAvailableLanguages());

// 3. Check dictionary size
console.log('Dictionary entries:', Object.keys(window.dictionaryManager.dictionary || {}).length);

// 4. Check extension state
console.log('Extension enabled:', window.featureToggle?.enabled);

// 5. Force page processing
window.pageProcessor.processPage();
console.log('✅ Page reprocessed');

// 6. Check storage
chrome.storage.local.get(null, (data) => {
  console.log('📦 Storage:', data);
});
```

## Need More Help?

If issues persist:
1. Check background script console:
   - Go to `chrome://extensions`
   - Click "Inspect views: background page" under Helios
   - Check for errors

2. Check manifest loaded correctly:
   - Verify all new files are in the extension folder
   - Check file paths match manifest.json

3. Clear all extension data and start fresh:
   ```javascript
   chrome.storage.local.clear(() => {
     console.log('All data cleared');
     // Reload extension
   });
   ```

---

**Remember:** After making changes, always reload the extension from `chrome://extensions`!
