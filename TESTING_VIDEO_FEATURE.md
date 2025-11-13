# Testing the Helios Video Feature

## Quick Start Testing Guide

### 1. Load the Extension
```bash
# Reload your extension in Chrome
# Go to chrome://extensions/
# Click "Reload" on Helios extension
```

### 2. Test on YouTube

**a) Visit any YouTube video**
- Example: https://www.youtube.com/watch?v=jNQXAC9IVRw (Me at the zoo)

**b) Auto-load YouTube captions**
- Press `Ctrl+Shift+Y` to auto-load captions
- OR wait 3 seconds for auto-load
- Check console for: `[Helios Video] Loaded X subtitles`

**c) Verify subtitle overlay**
- Play the video
- Subtitles should appear at bottom of video
- Text should have white color with black shadow/background
- Subtitles should sync with video timing

**d) Test text selection**
- Hover over subtitle text
- Click and drag to select text
- Selected text should be selectable

**e) Test side panel**
- Press `Ctrl+Shift+S` to toggle subtitle panel
- Panel should appear on right side
- All subtitles should be listed
- Currently playing subtitle should be highlighted in blue
- Click any subtitle to seek to that time

### 3. Test with Local Subtitle File

**a) Find a video with local subtitles**
- Visit any site with HTML5 video (e.g., Vimeo, local HTML file)
- Example local HTML:
```html
<!DOCTYPE html>
<html>
<body>
  <video width="640" height="360" controls>
    <source src="video.mp4" type="video/mp4">
  </video>
</body>
</html>
```

**b) Create a test SRT file** (`test.srt`):
```
1
00:00:01,000 --> 00:00:03,000
Hello, this is the first subtitle.

2
00:00:03,500 --> 00:00:06,000
This is the second subtitle.

3
00:00:06,500 --> 00:00:09,000
And this is the third one!
```

**c) Load subtitle file**
- Method 1: Press `Ctrl+Shift+L` and select file
- Method 2: Drag and drop `test.srt` onto the page
- Method 3: Click the floating blue button (📄) in bottom-right

**d) Verify notification**
- Should see green notification: "Loaded 3 subtitles from test.srt"

**e) Test playback**
- Play video
- Subtitles should appear at correct times
- Side panel should highlight current subtitle
- Should auto-scroll to keep current subtitle visible

### 4. Test Fullscreen Mode

**a) Enter fullscreen**
- Click fullscreen button on video player
- OR press `F` on YouTube

**b) Verify subtitle scaling**
- Subtitles should be larger (32px vs 24px)
- Should remain centered at bottom
- Text should remain selectable

**c) Test panel in fullscreen**
- Press `Ctrl+Shift+S`
- Panel should appear and be draggable
- Should remain visible in fullscreen

### 5. Test Drag and Drop

**a) Create drop zone**
- Drag any .srt or .vtt file over the page
- Large overlay should appear with message:
  "Drop subtitle file here"
  "Supports SRT, VTT formats"

**b) Drop file**
- Release mouse to drop
- File should load immediately
- Notification should confirm success

**c) Test invalid file**
- Try dropping a .txt or .pdf file
- Should show error: "Invalid file type. Please use SRT or VTT files."

### 6. Test VTT Format

**a) Create test VTT file** (`test.vtt`):
```
WEBVTT

00:00:01.000 --> 00:00:03.000
First VTT subtitle

00:00:03.500 --> 00:00:06.000
Second VTT subtitle

00:00:06.500 --> 00:00:09.000
Third VTT subtitle
```

**b) Load VTT file**
- Same methods as SRT (drag & drop or file picker)

**c) Verify parsing**
- Should correctly parse VTT timestamps (period instead of comma)
- Subtitles should display at correct times

### 7. Test Multiple Videos

**a) Visit page with multiple videos**
- Example: any news site with embedded videos

**b) Verify detection**
- Check console: `[Helios Video] Created binding for video`
- Should create binding for each video

**c) Test primary video**
- Load subtitle file
- Should load on the largest video element
- Other videos should not show subtitles

### 8. Test Panel Interactions

**a) Dragging panel**
- Click and hold panel header
- Drag to move panel around screen
- Release to drop in new position

**b) Scrolling**
- Load file with 50+ subtitles
- Panel should scroll
- Current subtitle should auto-scroll into view

**c) Clicking subtitles**
- Click any subtitle in panel
- Video should seek to that timestamp
- Video should start playing (if paused)

**d) Close panel**
- Click X button in top-right
- Panel should disappear
- Press `Ctrl+Shift+S` to reopen

### 9. Console Checks

**Expected console messages:**
```
[Helios Video] Initializing video feature...
[Helios Video] Video detector started
[Helios Video] Created binding for video: <video element>
✅ Helios video player initialized
[Helios Video] Loaded X subtitles (English)  // For YouTube
[Helios Video] Loaded X subtitles             // For local file
```

**No errors should appear** related to:
- Video binding
- Subtitle parsing
- Overlay rendering
- Panel display

### 10. Edge Cases to Test

**a) Video without source**
```html
<video controls></video>  <!-- No source -->
```
- Should NOT create binding
- Check console for validation

**b) Very long subtitle text**
```
1
00:00:01,000 --> 00:00:05,000
This is a very long subtitle that contains a lot of text and should wrap properly without breaking the layout or going off screen even in fullscreen mode.
```
- Should wrap text properly
- Should not overflow

**c) Overlapping subtitles**
```
1
00:00:01,000 --> 00:00:03,000
First subtitle

2
00:00:02,000 --> 00:00:04,000
Overlapping subtitle
```
- Both should display simultaneously
- Should stack vertically

**d) Rapid subtitle changes**
- Load file with 0.5s duration subtitles
- Should update smoothly without flickering

**e) Seek while playing**
- Play video
- Seek to different timestamp
- Subtitle should immediately update
- Panel should highlight correct subtitle

## Common Issues and Solutions

### Issue: Subtitles not showing
**Check:**
- Console for errors
- Video element has valid source
- Subtitle file was loaded successfully
- Current video time matches subtitle timing

**Solution:**
- Reload page
- Re-load subtitle file
- Check subtitle timestamps

### Issue: Panel not appearing
**Check:**
- Subtitles were loaded first
- Press `Ctrl+Shift+S` to toggle
- Check if panel is off-screen (try dragging)

**Solution:**
- Reload extension
- Check console for errors

### Issue: YouTube subtitles not loading
**Check:**
- Video has captions available
- Check YouTube player for caption button
- Console for parsing errors

**Solution:**
- Try manual load with `Ctrl+Shift+Y`
- Check if auto-generated captions are available
- Try different video

### Issue: Subtitle timing is off
**Possible causes:**
- Subtitle file has wrong timestamps
- Video source has offset

**Solution:**
- Use different subtitle file
- (Future feature: time offset adjustment)

### Issue: Can't select subtitle text
**Check:**
- CSS is loaded properly
- `pointer-events: auto` is set
- No overlay blocking interaction

**Solution:**
- Reload page
- Check video-styles.css is injected

## Performance Testing

### Memory Usage
- Open Chrome DevTools > Memory
- Take heap snapshot
- Should be ~2-5MB for typical subtitle file

### CPU Usage
- Open Chrome DevTools > Performance
- Record during video playback
- Subtitle update should be <1ms per frame

### Rendering Performance
- Use 1000+ subtitle file
- Panel should scroll smoothly
- No jank during playback

## Browser Compatibility

Test in:
- ✅ Chrome (primary)
- ✅ Edge (Chromium)
- ⚠️ Firefox (may need manifest tweaks)

## Next Steps After Testing

If all tests pass:
1. ✅ Basic feature is complete
2. Start Phase 2 features (see README.md)
3. Gather user feedback
4. Plan advanced features

If tests fail:
1. Check console errors
2. Review relevant component code
3. Add debugging console.logs
4. Test in isolation
5. Report issues with reproduction steps

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Extension version
3. Console error messages
4. Steps to reproduce
5. Expected vs actual behavior
6. Screenshot/video if applicable

## Success Criteria

The video feature is working correctly if:
- ✅ Videos are detected automatically
- ✅ Subtitles display and sync properly
- ✅ Text is selectable for lookup
- ✅ Side panel shows and functions
- ✅ All keyboard shortcuts work
- ✅ Drag & drop loads files
- ✅ YouTube auto-load works
- ✅ Fullscreen mode works
- ✅ No console errors
- ✅ Performance is smooth

## Congratulations!

If all tests pass, you now have a working proprietary video player feature that rivals Migaku and eliminates the need for ASB Player! 🎉