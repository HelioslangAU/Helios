# Quick Test Instructions

## Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find "Helios" extension
3. Click the reload button (🔄)

## Step 2: Test on YouTube

### Option A: Visit a video WITH Chinese subtitles
Try this video: https://www.youtube.com/watch?v=d8hxLJzFyLc
(Should have Chinese captions available)

### Option B: Visit any video and manually load subtitles

1. **Visit ANY YouTube video**

2. **Open Developer Console** (F12 or Ctrl+Shift+I)

3. **Run this command to manually load subtitles:**
```javascript
// See what's happening
window.heliosVideoFeature.youtubeLoader.getAvailableTracks().then(tracks => {
  console.log('Available subtitle tracks:', tracks);
});

// Try to load subtitles in Chinese
window.heliosVideoFeature.youtubeLoader.autoLoadSubtitles('zh');

// OR load in English
window.heliosVideoFeature.youtubeLoader.autoLoadSubtitles('en');
```

## Step 3: Check Console Output

You should see detailed debug logs like:
```
[Helios Video] Using language for YouTube subtitles: zh
[Helios YouTube] Auto-loading subtitles for language: zh
[Helios YouTube] Found ytInitialPlayerResponse in window
[Helios YouTube] Player object keys: [...]
[Helios YouTube] Found caption tracks: 2
[Helios YouTube] Track: en English
[Helios YouTube] Track: zh-Hans Chinese (Simplified)
[Helios YouTube] Available tracks: ['en (English)', 'zh-Hans (Chinese (Simplified))']
[Helios YouTube] Selected track: zh-Hans Chinese (Simplified)
[Helios YouTube] Loaded 234 subtitles (Chinese (Simplified))
```

## Step 4: Test Subtitle Display

Once loaded (check console for "Loaded X subtitles"):

1. **Play the video** - Subtitles should appear at bottom
2. **Press Ctrl+Shift+S** - Side panel should open with subtitle list
3. **Click a subtitle** in the panel - Video should seek to that time
4. **Select subtitle text** - Should trigger Helios word lookup

## Step 5: Test Manual File Loading

1. Create a test SRT file (test.srt):
```
1
00:00:01,000 --> 00:00:03,000
你好世界

2
00:00:03,500 --> 00:00:06,000
这是第二个字幕

3
00:00:06,500 --> 00:00:09,000
第三个字幕！
```

2. **Drag and drop** test.srt onto the YouTube page
3. Subtitles should load and display

## Troubleshooting

### If you see "Loaded 0 subtitles":

**Check:**
1. Does the video actually have subtitles? (Click CC button in YouTube player)
2. What language codes are available? Run:
   ```javascript
   window.heliosVideoFeature.youtubeLoader.getAvailableTracks()
   ```
3. Try a different video that definitely has Chinese subs

### If nothing happens at all:

**Check:**
1. Is the extension loaded? Look for initialization logs
2. Is there a video element? Run:
   ```javascript
   window.heliosVideoFeature.getPrimaryBinding()
   ```
3. Any errors in console?

### If subtitles don't display:

**Check:**
1. Console says "Loaded X subtitles" where X > 0?
2. CSS is loaded? Look for video-styles.css in Network tab
3. Try refreshing the page

## Success Indicators

✅ Console shows: `[Helios YouTube] Loaded X subtitles` (where X > 0)
✅ Subtitles appear on video when playing
✅ Side panel shows subtitle list (Ctrl+Shift+S)
✅ Clicking subtitle in panel seeks video
✅ Text in subtitle overlay is selectable

## Next Steps

Once basic functionality works:
1. Test on different video sites (Vimeo, etc.)
2. Test drag & drop
3. Test fullscreen mode
4. Start adding Phase 2 features (offset adjustment, dual subs, etc.)
