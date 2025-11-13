# YouTube Subtitle Loading Fix

## Problem

YouTube was returning **empty responses** (0 bytes) when trying to fetch subtitles directly from the content script. This is because:

1. **Content scripts run in an isolated context** - Cannot access `window.ytcfg`, `sessionStorage`, or YouTube's internal APIs
2. **YouTube blocks direct API calls** - Bot protection blocks WEB clients from fetching subtitles
3. **Missing authentication** - Subtitle URLs require either PoTokens or proper API keys

## Solution (Based on ASB Player)

ASB Player solves this by **injecting a script into the page context** (not the extension context), which:

1. **Runs with full access to YouTube's JavaScript** - Can access `window.ytcfg`, `window.sessionStorage`, etc.
2. **Uses the Android InnerTube API** - Pretends to be an Android client to bypass bot protection
3. **Communicates via custom events** - Sends subtitle data back to content script

## Implementation

### 1. Page Context Script
**File:** [src/content/video/youtube/youtube-page-script.js](src/content/video/youtube/youtube-page-script.js)

This script:
- Runs in YouTube's page context (not extension context)
- Accesses `window.ytcfg.get('INNERTUBE_API_KEY')`
- Makes POST request to `/youtubei/v1/player` with:
  ```json
  {
    "context": {
      "client": {
        "clientName": "ANDROID",  // ← Critical: bypasses bot protection
        "clientVersion": "19.09.36",
        "hl": "en"
      }
    },
    "videoId": "..."
  }
  ```
- Returns subtitle track URLs with `fmt=srv3` parameter

### 2. Updated YouTube Loader
**File:** [src/content/video/loaders/youtube-subtitle-loader.js](src/content/video/loaders/youtube-subtitle-loader.js)

Changes:
- **Injects page script** on YouTube pages
- **Sets up event listeners** for communication
- **Requests subtitles via custom events** instead of direct fetch
- **Receives track URLs** from page script
- **Fetches subtitle content** (now works because URLs have proper auth)

### 3. Communication Flow

```
Content Script (YouTubeSubtitleLoader)
    ↓ (injects <script> tag)
Page Context (youtube-page-script.js)
    ↓ (accesses window.ytcfg)
    ↓ (calls Android InnerTube API)
    ↓ (gets subtitle URLs)
    ↓ (dispatches custom event)
Content Script
    ↓ (receives event with URLs)
    ↓ (fetches subtitle XML)
    ↓ (parses and loads into video)
```

## Key Differences from Old Approach

### Old (Broken) ❌
```javascript
// Content script trying to use ytInitialPlayerResponse
const player = window.ytInitialPlayerResponse; // ← undefined in content script!
const tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks;
const response = await fetch(tracks[0].baseUrl); // ← Empty response (0 bytes)
```

### New (Working) ✅
```javascript
// Content script injects page script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('youtube-page-script.js');
document.head.appendChild(script);

// Page script (runs in YouTube's context)
const apiKey = window.ytcfg.get('INNERTUBE_API_KEY'); // ← Works!
const response = await fetch(`/youtubei/v1/player?key=${apiKey}`, {
  method: 'POST',
  body: JSON.stringify({
    context: { client: { clientName: 'ANDROID' } }, // ← Bypasses protection
    videoId: '...'
  })
});
```

## Files Changed

1. **Created:** `src/content/video/youtube/youtube-page-script.js` (148 lines)
   - Page context script that accesses YouTube internals

2. **Modified:** `src/content/video/loaders/youtube-subtitle-loader.js`
   - Removed old methods: `_getYouTubePlayer()`, `_extractTracksFromPlayer()`
   - Added script injection and event communication
   - Simplified to use page script instead of direct access

3. **Modified:** `manifest.json`
   - Added `src/content/video/youtube/youtube-page-script.js` to `web_accessible_resources`

## Testing

### 1. Reload Extension
Go to `chrome://extensions/` and reload Helios

### 2. Visit YouTube Video
Any video should work now (even ones without Chinese subtitles)

### 3. Check Console
You should see:
```
[Helios YouTube] Page script injected successfully
[Helios YouTube Page] Page script loaded
[Helios YouTube Page] Ready to fetch subtitles
[Helios YouTube Page] Auto-fetching subtitles for video: T3E9ANKg88I
[Helios YouTube Page] Fetching subtitles via InnerTube API
[Helios YouTube Page] Video ID: T3E9ANKg88I
[Helios YouTube Page] Found 8 caption tracks
[Helios YouTube] Received tracks from page script: 8
[Helios YouTube] Available tracks: ['zh (Chinese)', 'fr (French)', ...]
[Helios YouTube] Selected track: zh Chinese
[Helios YouTube] Fetching track from URL: https://...
[Helios YouTube] Received XML length: 45678 (← No longer 0!)
[Helios YouTube] Found text nodes: 234
[Helios YouTube] Created subtitle entries: 234
[Helios YouTube] Loaded 234 subtitles (Chinese)
```

### 4. Verify Subtitles Display
- **Play video** → Subtitles appear at bottom
- **Press Ctrl+Shift+S** → Side panel opens
- **Click subtitle** → Video seeks to that time

## Why This Works

### Android Client Magic
YouTube treats different clients differently:
- **WEB client**: Strict bot protection, blocks suspicious requests
- **ANDROID client**: More lenient, allows subtitle fetching
- **iOS client**: Similar to Android

By setting `clientName: 'ANDROID'`, we bypass YouTube's bot protection while still getting valid subtitle URLs.

### Page Context Access
Running in the page context means:
- ✅ Full access to YouTube's JavaScript variables
- ✅ Automatic inclusion of cookies and auth headers
- ✅ Same-origin requests (no CORS issues)
- ✅ Can use YouTube's internal API keys

### Event-Based Communication
Custom events allow:
- ✅ Page script → Content script data transfer
- ✅ No shared memory issues
- ✅ Clean separation of concerns
- ✅ Works across different contexts

## Limitations

### Still Subject to YouTube Changes
- If YouTube changes their InnerTube API, this will break
- If they change authentication requirements, needs update
- Client version may need periodic updates

### No Subtitles = No Loading
- If video genuinely has no subtitles, will return empty array
- Auto-generated subtitles may be lower quality
- Some languages may not be available

## Future Improvements

### Potential Enhancements
1. **PoToken fallback** - Implement PoToken decoding as backup method
2. **Cache subtitle tracks** - Avoid re-fetching on every page load
3. **Support more formats** - Add support for srv1, srv2, ttml3
4. **Better error messages** - Distinguish between "no subs" vs "fetch failed"
5. **Retry logic** - Retry failed requests with exponential backoff

## Credits

This implementation is based on the approach used by **ASB Player** (asbplayer-main repository), specifically:
- `extension/src/entrypoints/youtube-page.ts` - Android InnerTube API method
- `extension/src/services/pages.ts` - Script injection technique
- `extension/src/services/youtube.ts` - PoToken decoding (not yet implemented)

## References

- **ASB Player repo**: `C:\Users\tarun\Documents\GitHub\asbplayer-main`
- **YouTube InnerTube API**: Internal API used by YouTube's own clients
- **Script injection**: Chrome extension technique to run code in page context
- **Custom events**: DOM API for cross-context communication