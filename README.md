# Helios

**A powerful, open-source language learning browser extension**

Helios is a comprehensive browser extension designed to help language learners efficiently acquire and retain vocabulary through immersive browsing. It combines intelligent word detection, pop-up definitions, anki integrations, and video subtitles into a seamless learning experience.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)
![WXT](https://img.shields.io/badge/built%20with-WXT-67d55e)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285f4?logo=googlechrome)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Core Language Learning
- **Intelligent Word Detection** - Automatically identify and extract unknown words from web content
- **Context-Aware Dictionary** - Get definitions with real-world usage examples
- **Vocabulary Management** - Build and organize custom vocabulary lists
- **Spaced Repetition** - Anki integration allows you to make new cards with one click (audio + screenshot)
- **Progress Tracking** - Monitor your learning progress and vocabulary mastery

### Video Subtitle System
- **YouTube & Netflix Integration** - Auto-extract and display YouTube/Netflix captions
- **Interactive Learning** - Hover over subtitle text for instant word lookups
- **Side Panel Navigation** - Browse and seek to any subtitle with one click
- **Drag & Drop** - Simply drag subtitle files onto any page

## Getting Started

Helios is built with [WXT](https://wxt.dev) and TypeScript.

```bash
npm install     # also runs `wxt prepare` to generate types
npm run dev     # launches Chrome with the extension loaded, and hot-reloads
```

`npm run dev` opens a browser with the extension already installed — you don't need to load
it manually. To produce a build and load it yourself instead:

```bash
npm run build   # outputs .output/chrome-mv3/
```

Then go to `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `.output/chrome-mv3`.

### Other commands

| Command | Purpose |
|---|---|
| `npm run compile` | Type-check the whole project (`tsc --noEmit`) |
| `npm run zip` | Package for store submission |

> **Chrome/Edge only.** WXT can target Firefox, but the dictionary is hosted in an
> offscreen document and `chrome.offscreen` is Chromium-only. Supporting Firefox means
> porting that to a background page or a worker first, so the Firefox scripts are
> deliberately not wired up — a build would succeed and then fail at runtime.

## Project structure

```
wxt.config.ts          Manifest + build config (the manifest is generated, not hand-written)
src/
  entrypoints/         One entry per extension surface — WXT derives the manifest from these
    background.ts        Service worker
    content/             Main content script (<all_urls>)
    netflix-early.content.ts   document_start script for Netflix
    youtube-page.ts, netflix-page.ts   MAIN-world page scripts
    offscreen/           Offscreen document hosting the dictionary
    popup/, options/, onboarding/      Extension pages
  content/             Feature implementation (popup, video, settings, languages, …)
  services/            Screenshot, audio recording, media storage
  config/              paths.ts (asset URLs), storage.ts (typed chrome.storage schema)
  types/globals.d.ts   Declarations for shared `window.*` runtime globals
  lib/                 Vendored jieba segmenter
  public/              Copied to the output root as-is (icons, dictionaries, UI fragments)
```

Adding an entrypoint is enough to register it — there is no manifest to update by hand.

## Architecture

Helios uses a modular architecture with clear separation of concerns:

- **Content scripts** — interact with web pages and inject UI elements
- **Background service worker** — persistent data, Anki API calls, cross-tab messaging
- **Offscreen document** — hosts the dictionary (a service worker can't hold it in memory)
- **Popup interface** — quick access to key features
- **Settings page** — comprehensive customization options

Modules share state through a small set of `window.*` instances assigned during content-script
init, all declared in `src/types/globals.d.ts`. Load order is significant and is expressed by
the ordered side-effect imports in `src/entrypoints/content/index.ts`.

All persisted state goes through `src/config/storage.ts`, which declares every
`chrome.storage.local` key the extension uses and returns typed, partial results.

### Video subtitle system

The video feature uses a component-based design:

- **VideoDetector** — finds all video elements on the page
- **VideoBinding** — manages subtitles for an individual video
- **SubtitleParsers** — SRT and VTT support
- **SubtitleOverlay** — renders subtitles over the video
- **SubtitleListPanel** — navigation through the subtitle list


## How to Contribute
1. Fork the repository
2. Create a feature branch (git checkout -b feature/amazing-feature)
3. Commit your changes (git commit -m 'Add amazing feature')
4. Push to the branch (git push origin feature/amazing-feature)
5. Open a Pull Request


## Bug Reports & Feature Requests
Found a bug or have a feature idea? Please open an issue with:

- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots or screen recordings if helpful
- Your browser and extension version

This project is licensed under the MIT License - see the LICENSE file for details.
