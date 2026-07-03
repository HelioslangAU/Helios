# Helios

**A powerful, open-source language learning browser extension**

Helios is a comprehensive browser extension designed to help language learners efficiently acquire and retain vocabulary through immersive browsing. It combines intelligent word detection, pop-up definitions, anki integrations, and video subtitles into a seamless learning experience.

![Built with JavaScript](https://img.shields.io/badge/JavaScript-82%25-f7df1e?logo=javascript)
![CSS](https://img.shields.io/badge/CSS-11.7%25-1572b6?logo=css3)
![HTML](https://img.shields.io/badge/HTML-6.3%25-e34c26?logo=html5)
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

Install Dependencies:

```
npm install
```

Load in your browser:
Chrome/Edge: Go to chrome://extensions → Enable "Developer mode" → Click "Load unpacked" → Select the dist folder

## Architecture
Helios uses a modular architecture with clear separation of concerns:

- Content Scripts - Interact with web pages and inject UI elements
- Background Service Workers - Handle persistent data, API calls, and cross-tab communication
- Popup Interface - Quick access to key features
- Settings Page - Comprehensive customization options
- Video Subtitle System Architecture
- The video feature uses a component-based design:

- VideoDetector - Automatically finds all video elements on the page
- VideoBinding - Manages subtitles for individual videos
- SubtitleParsers - Support for multiple subtitle formats (SRT, VTT)
- SubtitleOverlay - Renders subtitles on top of video
- SubtitleListPanel - Provides navigation through subtitle list


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
