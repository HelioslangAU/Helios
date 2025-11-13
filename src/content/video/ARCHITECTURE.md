# Helios Video Feature - Technical Architecture

## Overview

A complete, proprietary video subtitle system built from scratch to rival Migaku and eliminate dependency on third-party players like ASB Player.

## Design Principles

1. **Modular**: Small, focused files (~200-300 lines each)
2. **Extensible**: Easy to add new formats, features
3. **Performance-first**: Efficient updates, minimal overhead
4. **Integration-ready**: Designed to work with existing Helios features

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│           VideoFeatureManager (main coordinator)         │
└────────┬─────────────┬─────────────┬─────────────┬──────┘
         │             │             │             │
    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
    │ Video   │   │Subtitle │   │Subtitle │   │   UI    │
    │Detector │   │ Panel   │   │  File   │   │Controller│
    │         │   │Controller│   │ Loader  │   │         │
    └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
         │             │             │             │
    ┌────▼────────────────────────────────────────────────┐
    │              Event Communication Layer              │
    │  (Custom events for component communication)        │
    └─────────────────────────────────────────────────────┘
```

## Component Hierarchy

### Level 1: Data Models
**Purpose**: Pure data structures with no dependencies

- `SubtitleEntry`: Represents single subtitle
- `SubtitleCollection`: Manages collection of subtitles

**Design**: Immutable-friendly, simple APIs

### Level 2: Parsers
**Purpose**: Convert file formats to data models

- `SRTParser`: Parse SubRip format
- `VTTParser`: Parse WebVTT format
- `SubtitleParser`: Auto-detect and delegate

**Design**: Static methods, no state, pure functions

### Level 3: UI Components
**Purpose**: Render and manage UI elements

- `SubtitleOverlay`: Renders subtitles on video
- `SubtitleListPanel`: Displays subtitle list

**Design**: Own lifecycle, minimal coupling

### Level 4: Core Logic
**Purpose**: Business logic and orchestration

- `VideoBinding`: Manages single video element
- `VideoDetector`: Finds and tracks all videos

**Design**: Event-driven, stateful

### Level 5: Loaders
**Purpose**: Load subtitles from various sources

- `SubtitleFileLoader`: Drag & drop + file picker
- `YouTubeSubtitleLoader`: Extract YouTube captions

**Design**: Async operations, error handling

### Level 6: Controllers
**Purpose**: Coordinate multiple components

- `SubtitlePanelController`: Manages panel lifecycle
- `VideoUIController`: Manages UI elements

**Design**: Facade pattern, event listeners

### Level 7: Manager
**Purpose**: Top-level coordination and initialization

- `VideoFeatureManager`: Initializes and coordinates everything

**Design**: Singleton pattern, dependency injection

## Data Flow

### Subtitle Loading Flow
```
User Action (drag file)
    ↓
SubtitleFileLoader detects file
    ↓
SubtitleParser.parseFile(file)
    ↓
Format detected → Specific parser
    ↓
SubtitleEntry[] created
    ↓
SubtitleCollection created
    ↓
VideoBinding.loadSubtitles()
    ↓
Event: 'helios-subtitles-loaded'
    ↓
SubtitlePanelController receives event
    ↓
SubtitleListPanel.loadSubtitles()
    ↓
UI updates (overlay + panel)
```

### Video Playback Flow
```
Video plays (100ms interval)
    ↓
VideoBinding._updateSubtitles()
    ↓
Get current time from video element
    ↓
SubtitleCollection.getSubtitlesAt(time)
    ↓
SubtitleOverlay.show(subtitles)
    ↓
DOM updated with current subtitle
    ↓
Event: 'helios-video-timeupdate'
    ↓
SubtitleListPanel.updateCurrentTime()
    ↓
Highlight current subtitle in panel
```

### Text Selection Flow
```
User selects subtitle text
    ↓
SubtitleOverlay mouseup handler
    ↓
Get selected text from window.getSelection()
    ↓
Event: 'helios-subtitle-selection'
    ↓
VideoFeatureManager receives event
    ↓
Integrate with Helios lookup system
    ↓
Show dictionary popup
```

## Event System

### Custom Events

**helios-video-detected**
- When: Video element is discovered
- Data: `{ video, binding }`
- Listeners: UI components

**helios-subtitles-loaded**
- When: Subtitles successfully loaded
- Data: `{ subtitleCount, videoElement, binding }`
- Listeners: Panel controller, UI controller

**helios-video-timeupdate**
- When: Video time changes (100ms)
- Data: `{ currentTime, videoElement, binding }`
- Listeners: Panel controller (for highlighting)

**helios-subtitle-selection**
- When: User selects subtitle text
- Data: `{ text, position, subtitle }`
- Listeners: Lookup integration

**helios-toggle-subtitle-panel**
- When: User presses Ctrl+Shift+S
- Data: None
- Listeners: Panel controller

**helios-autoload-youtube-subtitles**
- When: User presses Ctrl+Shift+Y
- Data: None
- Listeners: YouTube loader

### Why Events?

1. **Decoupling**: Components don't need direct references
2. **Extensibility**: Easy to add new listeners
3. **Debugging**: Can log all events in one place
4. **Testing**: Can simulate events for unit tests

## Performance Optimizations

### 1. Update Frequency
- **100ms interval** for subtitle sync (10 FPS)
- Balance between smoothness and CPU usage
- Could be configurable in settings

### 2. Video Detection
- **2s interval** for new video detection
- Only scans if document has changed
- Cleans up removed videos

### 3. DOM Operations
- **Batch updates** in overlay rendering
- **RequestAnimationFrame** for smooth animations
- **CSS transforms** for positioning (GPU-accelerated)

### 4. Memory Management
- **Clear intervals** when videos removed
- **Remove event listeners** on destroy
- **Garbage collection friendly** (no circular refs)

### 5. Parsing
- **Regex optimization** for timestamp parsing
- **Pre-compiled patterns** where possible
- **Lazy parsing** (could parse on-demand)

## State Management

### Video Binding State
```javascript
{
  videoElement: HTMLVideoElement,
  subtitleCollection: SubtitleCollection,
  overlay: SubtitleOverlay,
  updateInterval: number | null,
  isBound: boolean
}
```

### Video Detector State
```javascript
{
  bindings: Map<HTMLVideoElement, VideoBinding>,
  detectionInterval: number | null,
  isRunning: boolean
}
```

### Panel State
```javascript
{
  panel: HTMLElement,
  subtitleCollection: SubtitleCollection,
  currentTime: number,
  isVisible: boolean,
  currentBinding: VideoBinding | null
}
```

## Error Handling

### Levels of Error Handling

**1. Parser Level**
- Try/catch around file reading
- Return empty array on parse failure
- Log warnings for malformed entries

**2. Loader Level**
- Validate file types before parsing
- Show user-friendly notifications
- Don't crash on invalid files

**3. Binding Level**
- Check video source validity
- Handle missing subtitles gracefully
- Recover from playback errors

**4. Manager Level**
- Try/catch around initialization
- Fallback to ASB player integration
- Log errors without breaking page

### Error Recovery

```javascript
try {
  await videoFeature.init();
} catch (error) {
  console.warn('Video feature failed, using fallback');
  // Extension still works, just no video feature
}
```

## Testing Strategy

### Unit Tests (Future)
- Test parsers with various formats
- Test subtitle collection time lookups
- Test event firing and handling

### Integration Tests (Future)
- Test full subtitle loading flow
- Test video detection and binding
- Test panel interactions

### Manual Testing (Current)
- See TESTING_VIDEO_FEATURE.md
- Cover all user interactions
- Test edge cases

## Security Considerations

### Content Security Policy
- All styles are in external CSS (no inline styles that violate CSP)
- No eval() or dangerous patterns
- Safe DOM manipulation

### XSS Prevention
- Use `textContent` instead of `innerHTML` where possible
- Sanitize subtitle text (basic)
- Validate file types before parsing

### YouTube API
- Use public caption endpoints only
- No authentication required
- Respect YouTube's ToS

## Browser Compatibility

### Chrome/Edge (Primary)
- ✅ Manifest V3
- ✅ All features supported
- ✅ Shadow DOM detection

### Firefox
- ⚠️ Manifest V2/V3 differences
- ⚠️ May need polyfills
- ✅ Core features should work

### Safari
- ❓ Untested
- ⚠️ May need webkit prefixes
- ⚠️ Shadow DOM support varies

## Future Enhancements

### Short-term
1. **Subtitle offset adjustment** - UI for syncing subtitles
2. **Dual subtitles** - Show native + translation
3. **Custom styling** - User-configurable appearance
4. **Search subtitles** - Find text in subtitle list

### Medium-term
1. **ASS format support** - Advanced subtitle styling
2. **Auto-pause** - Pause at end of subtitle
3. **Anki export** - Direct export with screenshots
4. **Condensed audio** - Remove silent parts

### Long-term
1. **Cloud subtitle database** - Share/download subtitles
2. **OCR support** - Extract hardcoded subtitles
3. **Built-in video player** - Dedicated player page
4. **Mobile support** - Companion mobile app

## Comparison to ASB Player

### What We Kept
- ✅ Subtitle overlay concept
- ✅ Side panel design
- ✅ Drag & drop loading
- ✅ YouTube integration

### What We Improved
- ✅ Simpler architecture (modular files)
- ✅ Better integration with Helios
- ✅ Cleaner code organization
- ✅ More extensible design

### What We Simplified
- No video recording (for now)
- No mining UI (use Helios popup instead)
- No advanced video controls (use native player)
- No syncing with external app (for now)

## Maintenance

### Adding New Features
1. Create new file in appropriate folder
2. Follow existing patterns (events, lifecycle)
3. Update VideoFeatureManager to initialize
4. Add to manifest.json
5. Document in README.md

### Modifying Existing Features
1. Check component dependencies
2. Update related event handlers
3. Test integration points
4. Update documentation

### Debugging
1. Check console for initialization logs
2. Use Chrome DevTools to inspect events
3. Add breakpoints in relevant components
4. Check network tab for YouTube requests

## Conclusion

This architecture provides a solid foundation for a proprietary video player feature that:
- Rivals commercial solutions like Migaku
- Eliminates need for third-party players
- Integrates seamlessly with Helios
- Is maintainable and extensible
- Performs efficiently

Total implementation: ~15 files, ~2000 lines of code, all modular and well-organized.