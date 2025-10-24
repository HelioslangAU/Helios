# Multi-Language Onboarding Implementation

## Overview

This document details the implementation of the onboarding and language selection features for Helios, enabling users to choose their target language when first installing the extension and switch languages seamlessly.

## New Features

### 1. **First-Run Onboarding Experience**
- Beautiful welcome screen shown on first install
- Language selection with visual cards for all 4 supported languages
- Feature highlights and quick tips
- Guided 3-step flow: Welcome → Language Selection → Success

### 2. **Smooth Language Switching**
- Fixed message handling for language changes
- Coordinated switching with proper cleanup
- Loading indicators during dictionary reload
- Success/error notifications

### 3. **Modular Architecture**
All components are small, focused, and reusable following best practices.

## File Structure

```
LanguageExtension/
├── src/
│   ├── content/
│   │   ├── components/
│   │   │   └── language-selector/          # NEW: Reusable component
│   │   │       ├── language-selector.js    # Language picker widget
│   │   │       └── language-selector.css   # Styling
│   │   ├── onboarding/                     # NEW: Onboarding logic
│   │   │   ├── first-run-detector.js       # Detects first install
│   │   │   └── onboarding-controller.js    # Coordinates flow
│   │   └── utils/
│   │       └── language-switch-coordinator.js  # NEW: Handles switching
│   └── ui/
│       └── onboarding/                     # NEW: Onboarding UI
│           ├── onboarding.html             # Onboarding page
│           ├── onboarding.css              # Styling
│           └── onboarding.js               # Page logic
```

## Components

### 1. Language Selector Component
**Files:**
- [language-selector.js](src/content/components/language-selector/language-selector.js)
- [language-selector.css](src/content/components/language-selector/language-selector.css)

**Purpose:** Reusable component for displaying and selecting languages

**Features:**
- Grid or dropdown layout options
- Language metadata (flags, names, descriptions)
- Selection callback support
- Fully styled and responsive

**Usage:**
```javascript
const selector = new LanguageSelector({
  layout: 'grid',
  selectedLanguage: 'en',
  onLanguageSelected: (code, language) => {
    console.log(`Selected: ${code}`);
  }
});
document.body.appendChild(selector.render());
```

### 2. First Run Detector
**File:** [first-run-detector.js](src/content/onboarding/first-run-detector.js)

**Purpose:** Detects if user is running extension for the first time

**Key Methods:**
- `hasCompletedOnboarding()` - Check if onboarding done
- `markOnboardingComplete()` - Set completion flag
- `isFreshInstall()` - Check if brand new install
- `resetOnboarding()` - For testing purposes

### 3. Onboarding Controller
**File:** [onboarding-controller.js](src/content/onboarding/onboarding-controller.js)

**Purpose:** Orchestrates the onboarding flow

**Key Methods:**
- `shouldShowOnboarding()` - Determine if onboarding needed
- `completeOnboarding(languageCode)` - Save selection and finish
- `getCurrentLanguage()` - Get saved language preference
- `openOnboardingPage()` - Open onboarding in new tab

### 4. Language Switch Coordinator
**File:** [language-switch-coordinator.js](src/content/utils/language-switch-coordinator.js)

**Purpose:** Manages the complete language switching process

**Features:**
- Closes open popups before switching
- Clears old language highlights
- Loads new dictionary
- Reprocesses page with new language
- Shows loading/success/error notifications
- Prevents concurrent switches

**Key Methods:**
- `switchLanguage(newLanguageCode)` - Main switching method
- `isSwitchingLanguage()` - Check if switch in progress

### 5. Onboarding Page
**Files:**
- [onboarding.html](src/ui/onboarding/onboarding.html)
- [onboarding.css](src/ui/onboarding/onboarding.css)
- [onboarding.js](src/ui/onboarding/onboarding.js)

**Purpose:** User-facing onboarding interface

**Steps:**
1. **Welcome** - Feature highlights and introduction
2. **Language Selection** - Choose target language
3. **Success** - Confirmation and quick tips

**Features:**
- Beautiful gradient design
- Progress indicator
- Responsive layout
- Animated transitions
- Quick tips for getting started

## Integration Points

### 1. Background Script Updates
**File:** [background.js](background.js)

**Changes:**
- Detects first install via `chrome.runtime.onInstalled`
- Opens onboarding page automatically
- Handles `onboardingCompleted` message
- Broadcasts language changes to all tabs
- Initializes `targetLanguage`, `installDate`, `hasCompletedOnboarding`

### 2. Content Script Updates
**File:** [content.js](src/content/content.js)

**Changes:**
- Initializes `LanguageSwitchCoordinator`
- Uses coordinator for all language changes
- Default language set to `'en'` (English)
- Exposes coordinator globally for debugging

### 3. Settings Sync Updates
**File:** [settings-sync.js](src/content/settings/settings-sync.js)

**Changes:**
- Added listener for `updateLanguage` action
- Calls `onLanguageChanged` callback when received
- Properly handles direct language change messages from settings UI

### 4. Manifest Updates
**File:** [manifest.json](manifest.json)

**Changes:**
- Added `language-switch-coordinator.js` to content scripts
- Added all onboarding files to `web_accessible_resources`
- Added language selector component files

## User Flow

### First Install
```
1. User installs extension
   ↓
2. Background detects install event
   ↓
3. Opens onboarding.html in new tab
   ↓
4. User sees welcome screen with features
   ↓
5. User clicks "Get Started"
   ↓
6. Language selection cards appear
   ↓
7. User selects target language (e.g., Spanish)
   ↓
8. User clicks "Complete Setup"
   ↓
9. Language saved to chrome.storage.local
   ↓
10. Onboarding marked complete
   ↓
11. Success screen shows with tips
   ↓
12. User clicks "Start Learning" (closes tab)
```

### Language Switching
```
1. User opens Settings → General
   ↓
2. Changes "Target Language" dropdown
   ↓
3. Settings UI sends "updateLanguage" message
   ↓
4. Content script receives message
   ↓
5. SettingsSync calls onLanguageChanged callback
   ↓
6. LanguageSwitchCoordinator.switchLanguage() runs:
   - Shows loading notification
   - Closes popups
   - Clears highlights
   - Updates language registry
   - Loads new dictionary
   - Reprocesses page
   - Saves to storage
   - Shows success notification
   ↓
7. Page now highlights words in new language
```

## Testing Guide

### Test 1: First Install Onboarding
1. **Reset onboarding:**
   - Open DevTools console on any page
   - Run: `chrome.storage.local.remove(['hasCompletedOnboarding', 'installDate'])`

2. **Reload extension:**
   - Go to `chrome://extensions`
   - Click reload on Helios

3. **Verify:**
   - Onboarding page should open automatically
   - Can navigate through all 3 steps
   - Language selection works
   - Completion saves preference
   - Success page shows correct language name

### Test 2: Language Switching via Settings
1. **Open Settings:**
   - Click Helios icon → "Settings"

2. **Change Language:**
   - Go to General tab
   - Change "Target Language" dropdown
   - Select different language (e.g., French)

3. **Verify:**
   - Loading notification appears top-right
   - Success notification shows "✓ Switched to French"
   - Storage updated: Check `chrome.storage.local.get('targetLanguage')`
   - Page reprocessed with new language

4. **Test on Live Page:**
   - Navigate to a webpage in target language
   - Hold Shift and hover over words
   - Definitions should be in correct language

### Test 3: Language Switching Between All 4
1. Switch from English → Chinese
2. Switch from Chinese → Spanish
3. Switch from Spanish → French
4. Switch from French → English

**Verify each switch:**
- Loading and success notifications
- Correct dictionary loaded
- Page highlights update
- Popup shows correct definitions

### Test 4: Error Handling
1. **Test rapid switching:**
   - Quickly change language multiple times
   - Should see console warning: "Language switch already in progress"
   - Should not crash

2. **Test with no network:**
   - Disconnect internet
   - Try switching language
   - Should see error notification

## Storage Keys

The extension now uses these storage keys:

| Key | Type | Description |
|-----|------|-------------|
| `hasCompletedOnboarding` | boolean | Whether user finished onboarding |
| `onboardingCompletedDate` | string (ISO) | When onboarding was completed |
| `installDate` | string (ISO) | When extension was first installed |
| `targetLanguage` | string | Current language code ('zh', 'en', 'es', 'fr') |

## Debugging

### Console Commands

```javascript
// Check onboarding status
chrome.storage.local.get(['hasCompletedOnboarding', 'targetLanguage'], console.log)

// Reset onboarding (for testing)
chrome.storage.local.remove(['hasCompletedOnboarding', 'installDate'])

// Check if switching in progress
window.languageSwitchCoordinator.isSwitchingLanguage()

// Manually trigger language switch
window.languageSwitchCoordinator.switchLanguage('fr')

// Get available languages
window.languageRegistry.getAvailableLanguages()
```

## Future Enhancements

### Potential Improvements
1. **Quick Language Switcher**
   - Add dropdown to extension popup for fast switching
   - Show current language in popup

2. **Browser Locale Detection**
   - Auto-detect user's browser language
   - Suggest appropriate target language

3. **Onboarding Reopening**
   - Add "Show Onboarding Again" in settings
   - Help button that opens onboarding

4. **Language Profiles**
   - Save separate vocab lists per language
   - Switch between learning profiles

5. **Multi-Language Mode**
   - Learn multiple languages simultaneously
   - Toggle between active languages

## Troubleshooting

### Onboarding doesn't appear on install
- Check console for errors
- Verify `background.js` is loading
- Check if `hasCompletedOnboarding` is already set
- Clear extension storage and reload

### Language switching doesn't work
- Check DevTools console for errors
- Verify dictionary files exist for target language
- Check `settings-sync.js` has `updateLanguage` listener
- Ensure `language-switch-coordinator.js` loaded

### Notifications not showing
- Check if page has `<body>` element
- Verify coordinator is initialized
- Check for CSS conflicts
- Look for console errors

## Code Quality

### Best Practices Followed
✅ Small, focused files (each < 300 lines)
✅ Single Responsibility Principle
✅ Reusable components
✅ Proper error handling
✅ Comprehensive comments
✅ Consistent naming conventions
✅ No hardcoded values
✅ Modular architecture

### Performance
- Language switching happens asynchronously
- Dictionary loading is cached
- No blocking operations
- Efficient DOM manipulation
- Debounced user interactions

## Browser Compatibility

Tested and working in:
- Chrome 88+
- Edge 88+
- Brave 1.20+

Requires Manifest V3 support.

---

**Implementation completed:** 2024
**Version:** 0.1.1
**Author:** Helios Development Team
