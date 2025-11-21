/**
 * Onboarding Page Script
 * Handles the onboarding flow and user interactions
 */

class OnboardingPage {
  constructor() {
    this.currentStep = 'language';
    this.controller = new OnboardingController();
    this.languageSelector = null;
    this.selectedLanguage = null;
    this.selectedLevel = null;
    this.shouldImportWords = true;
    this.vocabManager = null;

    this.init();
  }

  async init() {
    console.log('Initializing onboarding page...');

    // Initialize vocab manager
    this.vocabManager = new VocabManager();

    // Set up event listeners
    this.setupEventListeners();

    // Set up interactive demo
    this.setupInteractiveDemo();

    // Set up floating characters background
    this.setupFloatingCharacters();

    // Check if onboarding should be shown
    const shouldShow = await this.controller.shouldShowOnboarding();
    if (!shouldShow) {
      console.log('Onboarding already completed, redirecting...');
      this.redirectToSettings();
      return;
    }

    // Show language selection step (first step)
    this.showStep('language');
    this.initializeLanguageSelector();
  }

  setupEventListeners() {
    // Step 1: Language selection - Next button
    document.getElementById('btn-lang-next')?.addEventListener('click', () => {
      this.goToLevelSelection();
    });

    // Step 2: Level selection - Back/Next buttons
    document.getElementById('btn-level-back')?.addEventListener('click', () => {
      this.showStep('language');
    });
    document.getElementById('btn-level-next')?.addEventListener('click', () => {
      this.handleLevelSelection();
    });

    // Step 3: Hero - Get Started button
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.showStep('popup');
    });

    // Step 4: Popup feature - Back/Next buttons
    document.getElementById('btn-popup-back')?.addEventListener('click', () => {
      this.showStep('hero');
    });
    document.getElementById('btn-popup-next')?.addEventListener('click', () => {
      this.showStep('banner');
    });

    // Step 5: Banner feature - Back/Next buttons
    document.getElementById('btn-banner-back')?.addEventListener('click', () => {
      this.showStep('popup');
    });
    document.getElementById('btn-banner-next')?.addEventListener('click', () => {
      this.showStep('highlighting');
    });

    // Step 6: Highlighting feature - Back/Next buttons
    document.getElementById('btn-highlight-back')?.addEventListener('click', () => {
      this.showStep('banner');
    });
    document.getElementById('btn-highlight-next')?.addEventListener('click', () => {
      this.completeOnboarding();
    });

    // Step 7: Success - Start Learning button
    document.getElementById('btn-start-learning')?.addEventListener('click', () => {
      this.startUsingExtension();
    });
  }

  initializeLanguageSelector() {
    if (this.languageSelector) {
      return; // Already initialized
    }

    const container = document.getElementById('language-selector-container');
    if (!container) {
      console.error('Language selector container not found');
      return;
    }

    // Create language selector
    this.languageSelector = new LanguageSelector({
      layout: 'grid',
      containerClass: 'language-selector',
      onLanguageSelected: (code, language) => {
        this.handleLanguageSelection(code, language);
      }
    });

    // Render and append
    const selectorElement = this.languageSelector.render();
    container.innerHTML = '';
    container.appendChild(selectorElement);
  }

  handleLanguageSelection(code, language) {
    console.log(`Language selected: ${code} (${language.name})`);
    this.selectedLanguage = { code, ...language };

    // Enable next button
    const nextBtn = document.getElementById('btn-lang-next');
    if (nextBtn) {
      nextBtn.disabled = false;
    }
  }

  async goToLevelSelection() {
    if (!this.selectedLanguage) {
      alert('Please select a language before continuing');
      return;
    }

    // Set language in vocab manager
    this.vocabManager.setCurrentLanguage(this.selectedLanguage.code);

    // Show level selection step
    this.showStep('level');
    this.initializeLevelSelector();
  }

  async initializeLevelSelector() {
    const container = document.getElementById('level-selector-container');
    if (!container) {
      console.error('Level selector container not found');
      return;
    }

    // Get language adapter to retrieve level definitions
    const adapter = await this.getLanguageAdapter(this.selectedLanguage.code);
    if (!adapter) {
      console.error('Could not get language adapter');
      container.innerHTML = '<p>Level selection not available for this language.</p>';
      return;
    }

    const levels = adapter.getLevelDefinitions();
    if (!levels || levels.length === 0) {
      container.innerHTML = '<p>No proficiency levels defined for this language.</p>';
      return;
    }

    // Create level selector UI
    container.innerHTML = '';
    levels.forEach(level => {
      const levelOption = document.createElement('div');
      levelOption.className = 'level-option';
      levelOption.dataset.level = level.level;
      levelOption.innerHTML = `
        <div class="level-name">${level.name}</div>
        <div class="level-word-count">${level.wordCount.toLocaleString()} words</div>
      `;
      levelOption.addEventListener('click', () => {
        // Remove selected class from all options
        container.querySelectorAll('.level-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        // Add selected class to clicked option
        levelOption.classList.add('selected');
        this.selectedLevel = level;
      });
      container.appendChild(levelOption);
    });

    // Set up import checkbox
    const importCheckbox = document.getElementById('import-words-checkbox');
    if (importCheckbox) {
      importCheckbox.addEventListener('change', (e) => {
        this.shouldImportWords = e.target.checked;
      });
    }
  }

  async getLanguageAdapter(languageCode) {
    // Try to get adapter from language registry if available
    if (window.languageRegistry) {
      return window.languageRegistry.getAdapter(languageCode);
    }

    // Fallback: create adapter directly based on language code
    // This is a simplified approach - in production, you'd want to use the registry
    try {
      // Dynamically import language adapters
      const adapters = {
        'zh': ChineseLanguageAdapter,
        'es': SpanishLanguageAdapter,
        'fr': FrenchLanguageAdapter,
        'en': EnglishLanguageAdapter
      };

      const AdapterClass = adapters[languageCode];
      if (AdapterClass) {
        return new AdapterClass();
      }
    } catch (error) {
      console.error('Error creating language adapter:', error);
    }

    return null;
  }

  async handleLevelSelection() {
    if (!this.selectedLevel) {
      alert('Please select a proficiency level');
      return;
    }

    // If user wants to import words, do it now
    if (this.shouldImportWords) {
      try {
        const nextBtn = document.getElementById('btn-level-next');
        if (nextBtn) {
          nextBtn.textContent = 'Importing words...';
          nextBtn.disabled = true;
        }

        await this.importWordsForLevel(this.selectedLanguage.code, this.selectedLevel);
        
        if (nextBtn) {
          nextBtn.textContent = 'Continue →';
          nextBtn.disabled = false;
        }
      } catch (error) {
        console.error('Error importing words:', error);
        alert('Error importing words. You can continue without importing.');
      }
    }

    // Continue to hero step
    this.showStep('hero');
  }

  async importWordsForLevel(languageCode, level) {
    console.log(`Importing words for ${languageCode} level ${level.level}...`);

    // Get language adapter
    const adapter = await this.getLanguageAdapter(languageCode);
    if (!adapter) {
      throw new Error('Could not get language adapter');
    }

    // Get vocabulary file path
    const vocabPath = adapter.getOnboardingVocabPath(level.level);
    if (!vocabPath) {
      console.warn('No vocabulary file path defined for this level');
      return;
    }

    try {
      // Load CSV file
      const fullPath = chrome.runtime.getURL(vocabPath);
      const response = await fetch(fullPath);
      
      if (!response.ok) {
        throw new Error(`Failed to load vocabulary file: ${response.statusText}`);
      }

      const csvText = await response.text();
      
      // Parse CSV - handle quoted fields and simple one-word-per-line format
      const parseCSVLine = (line) => {
        line = line.trim();
        if (!line) return null;
        
        // Handle quoted fields (e.g., "el, la")
        if (line.startsWith('"') && line.endsWith('"')) {
          return line.slice(1, -1).trim();
        }
        return line;
      };

      const lines = csvText.split('\n')
        .map(parseCSVLine)
        .filter(line => line && !line.startsWith('#'));
      
      // Extract words up to the level's word count
      const wordsToImport = lines.slice(0, level.wordCount);
      
      console.log(`Importing ${wordsToImport.length} words for level ${level.level}...`);

      // Load vocab manager and import words
      await this.vocabManager.loadKnownWords();
      const result = await this.vocabManager.markMultipleWordsAsKnown(wordsToImport);
      
      console.log(`✅ Imported ${result.newWordsCount} new words (${result.processedWordsCount} processed)`);
      
      return result;
    } catch (error) {
      console.error('Error importing words from CSV:', error);
      throw error;
    }
  }

  async completeOnboarding() {
    if (!this.selectedLanguage) {
      alert('Please select a language before continuing');
      return;
    }

    try {
      // Show loading state
      const nextBtn = document.getElementById('btn-highlight-next');
      if (nextBtn) {
        nextBtn.textContent = 'Setting up...';
        nextBtn.disabled = true;
      }

      // Complete onboarding
      await this.controller.completeOnboarding(this.selectedLanguage.code);

      // Update success step with selected language
      const languageNameElement = document.getElementById('selected-language-name');
      if (languageNameElement) {
        languageNameElement.textContent = this.selectedLanguage.name;
      }

      // Show success step
      this.showStep('success');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('An error occurred. Please try again.');

      // Reset button
      const nextBtn = document.getElementById('btn-highlight-next');
      if (nextBtn) {
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = false;
      }
    }
  }

  startUsingExtension() {
    // Close onboarding and navigate to a webpage
    window.close();
  }

  redirectToSettings() {
    const settingsUrl = chrome.runtime.getURL('src/ui/settings/helios-settings.html');
    window.location.href = settingsUrl;
  }

  showStep(stepName) {
    // Hide all steps
    document.querySelectorAll('.onboarding-step').forEach(step => {
      step.classList.remove('active');
    });

    // Show target step
    const targetStep = document.getElementById(`step-${stepName}`);
    if (targetStep) {
      targetStep.classList.add('active');
      this.currentStep = stepName;
    }

    // Update progress indicator
    this.updateProgressIndicator(stepName);
  }

  updateProgressIndicator(stepName) {
    const dots = document.querySelectorAll('.progress-dot');

    // Map step names to indices (7-step flow)
    const stepIndex = {
      'language': 0,
      'level': 1,
      'hero': 2,
      'popup': 3,
      'banner': 4,
      'highlighting': 5,
      'success': 6
    };

    const currentIndex = stepIndex[stepName] ?? 0;

    dots.forEach((dot, index) => {
      if (index <= currentIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  setupInteractiveDemo() {
    let isShiftPressed = false;
    let demoPopup = null;

    // Track shift key state
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        isShiftPressed = true;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        isShiftPressed = false;
        this.closeDemoPopup();
      }
    });

    // Add hover listeners to all highlighted words
    const highlightedWords = document.querySelectorAll('#interactive-sample .highlighted-word');
    highlightedWords.forEach(word => {
      word.addEventListener('mouseenter', (e) => {
        if (isShiftPressed) {
          this.showDemoPopup(e.target);
        }
      });

      word.addEventListener('mouseleave', () => {
        if (!isShiftPressed) {
          this.closeDemoPopup();
        }
      });
    });
  }

  showDemoPopup(wordElement) {
    // Close existing popup
    this.closeDemoPopup();

    const word = wordElement.dataset.word;
    const definitions = JSON.parse(wordElement.dataset.definitions);

    // Create popup
    const popup = document.createElement('div');
    popup.className = 'demo-popup';
    popup.innerHTML = `
      <div class="demo-popup-top-accent"></div>
      <div class="demo-popup-body">
        <button class="demo-popup-anki-btn">A</button>
        <div class="demo-popup-char-container">
          <div class="demo-popup-character">
            <div class="demo-popup-char">${word}</div>
          </div>
        </div>
        <div class="demo-popup-definitions">
          <div class="demo-popup-def-block">
            ${definitions.map(def => `<div class="demo-popup-def-item">• ${def}</div>`).join('')}
          </div>
        </div>
        <button class="demo-popup-known-btn">Mark Known</button>
      </div>
    `;

    // Position popup
    const rect = wordElement.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 10}px`;
    popup.style.zIndex = '10000';

    document.body.appendChild(popup);
    this.demoPopup = popup;

    // Add click prevention
    popup.addEventListener('click', (e) => e.stopPropagation());
  }

  closeDemoPopup() {
    if (this.demoPopup) {
      this.demoPopup.remove();
      this.demoPopup = null;
    }
  }

  setupFloatingCharacters() {
    const floatingBg = document.getElementById('floating-bg');
    if (!floatingBg) return;

    // Multilingual characters representing different languages
    const characters = [
      // Chinese
      '学', '习', '你', '好', '世', '界', '爱', '人', '中', '国',
      // Spanish
      'á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡',
      // French
      'à', 'è', 'é', 'ê', 'ç', 'œ',
      // English (stylized)
      'A', 'B', 'C', 'D', 'E', 'F'
    ];

    // Create 30 floating characters
    for (let i = 0; i < 30; i++) {
      const char = document.createElement('div');
      char.className = 'floating-char';
      char.textContent = characters[Math.floor(Math.random() * characters.length)];

      // Random position
      char.style.left = `${Math.random() * 100}%`;
      char.style.top = `${Math.random() * 100}%`;

      // Random size
      const size = 40 + Math.random() * 60;
      char.style.fontSize = `${size}px`;

      // Random animation duration (slower = more graceful)
      const duration = 20 + Math.random() * 30;
      char.style.animationDuration = `${duration}s`;

      // Random animation delay
      char.style.animationDelay = `${Math.random() * 10}s`;

      // Random opacity
      const opacity = 0.03 + Math.random() * 0.07;
      char.style.opacity = opacity;

      floatingBg.appendChild(char);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OnboardingPage();
  });
} else {
  new OnboardingPage();
}
