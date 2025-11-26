/**
 * Onboarding Page Script
 * Handles the onboarding flow and user interactions
 */

class OnboardingPage {
  constructor() {
    this.currentStep = 'hero';
    this.controller = new OnboardingController();
    this.languageSelector = null;
    this.selectedLanguage = null;
    this.selectedLevel = null;
    this.shouldImportWords = true;
    this.vocabManager = null;
    
    // Popup system components
    this.popupSystemInitialized = false;
    this.dictionaryManager = null;
    this.dictionaryBridge = null; // For early dictionary loading
    this.highlightManager = null;
    this.pageProcessor = null;
    this.popupManager = null;
    this.lookupController = null;
    this.activationController = null;
    this.frequencyManager = null;
    this.dictionaryLoaded = false;
    
    // Store event handler references for cleanup
    this.eventHandlers = {
      keydown: null,
      keyup: null,
      pointermove: null,
      click: null
    };

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

    // Show hero welcome step (first step)
    this.showStep('hero');
  }

  setupEventListeners() {
    // Step 1: Hero - Get Started button
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.showStep('language');
      this.initializeLanguageSelector();
    });

    // Step 2: Language selection - Back/Next buttons
    document.getElementById('btn-lang-back')?.addEventListener('click', () => {
      this.showStep('hero');
    });
    document.getElementById('btn-lang-next')?.addEventListener('click', () => {
      this.goToTutorial();
    });

    // Step 3: Popup feature - Back/Next buttons
    document.getElementById('btn-popup-back')?.addEventListener('click', () => {
      this.showStep('language');
    });
    document.getElementById('btn-popup-next')?.addEventListener('click', () => {
      this.showStep('level');
      this.initializeLevelSelector();
    });

    // Step 4: Level selection - Back/Next buttons
    document.getElementById('btn-level-back')?.addEventListener('click', () => {
      this.showStep('popup');
    });
    document.getElementById('btn-level-next')?.addEventListener('click', () => {
      this.handleLevelSelection();
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
    
    // If language changed, reset popup system to allow reinitialization
    if (this.selectedLanguage && this.selectedLanguage.code !== code) {
      console.log('Language changed, resetting popup system...');
      this.resetPopupSystem();
    }
    
    this.selectedLanguage = { code, ...language };

    // Start loading dictionary in offscreen script immediately
    this.startDictionaryLoading(code);

    // Enable next button
    const nextBtn = document.getElementById('btn-lang-next');
    if (nextBtn) {
      nextBtn.disabled = false;
    }
  }

  resetPopupSystem() {
    // Clean up event listeners first
    this.cleanupEventListeners();
    
    // Reset initialization flag
    this.popupSystemInitialized = false;
    
    // Reset components
    this.lookupController = null;
    this.popupManager = null;
    this.pageProcessor = null;
    this.highlightManager = null;
    this.dictionaryManager = null;
    this.frequencyManager = null;
    this.languageRegistry = null;
    this.activationController = null;
    
    // Clear dictionary bridge to force reload for new language
    this.dictionaryBridge = null;
    this.dictionaryLoaded = false;
  }

  cleanupEventListeners() {
    // Remove all event listeners if they exist
    if (this.eventHandlers.keydown) {
      document.removeEventListener('keydown', this.eventHandlers.keydown);
      this.eventHandlers.keydown = null;
    }
    if (this.eventHandlers.keyup) {
      document.removeEventListener('keyup', this.eventHandlers.keyup);
      this.eventHandlers.keyup = null;
    }
    if (this.eventHandlers.pointermove) {
      document.removeEventListener('pointermove', this.eventHandlers.pointermove);
      this.eventHandlers.pointermove = null;
    }
    if (this.eventHandlers.click) {
      document.removeEventListener('click', this.eventHandlers.click);
      this.eventHandlers.click = null;
    }
  }

  async startDictionaryLoading(languageCode) {
    try {
      console.log(`📚 Starting dictionary loading for ${languageCode} in offscreen...`);
      
      // Don't show loading bar yet - load in background while user selects level
      // Create a DictionaryBridge instance to communicate with offscreen
      if (!this.dictionaryBridge) {
        if (typeof DictionaryBridge !== 'undefined') {
          this.dictionaryBridge = new DictionaryBridge();
          // Ensure offscreen document is ready
          await this.dictionaryBridge.ensureOffscreenDocument();
        } else {
          // Fallback: send message directly to background/offscreen
          chrome.runtime.sendMessage({
            action: 'DICT_LOAD',
            languageCode: languageCode
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Could not trigger dictionary loading:', chrome.runtime.lastError);
            } else if (response && response.success) {
              console.log(`✅ Dictionary loading started for ${languageCode}`);
            }
          });
          return;
        }
      }
      
      // Start loading dictionary (this is async but we don't wait for it)
      // It will load in the background while user selects level
      this.dictionaryBridge.loadDictionary(languageCode).then(result => {
        if (result.success) {
          console.log(`✅ Dictionary loaded for ${languageCode}: ${result.size} entries`);
          this.dictionaryLoaded = true;
        } else {
          console.warn(`⚠️ Dictionary loading failed:`, result.error);
        }
      }).catch(error => {
        console.warn(`⚠️ Dictionary loading error:`, error);
      });
    } catch (error) {
      console.warn('Could not start dictionary loading:', error);
      // Don't block the user flow if dictionary loading fails
      // Try fallback method
      try {
        chrome.runtime.sendMessage({
          action: 'DICT_LOAD',
          languageCode: languageCode
        });
      } catch (e) {
        // Ignore - dictionary will load later when popup system initializes
      }
    }
  }

  showDictionaryLoadingBar() {
    const container = document.getElementById('dictionary-loading-container');
    if (container) {
      container.style.display = 'block';
      this.updateLoadingProgress(0);
    }
  }

  hideDictionaryLoadingBar() {
    const container = document.getElementById('dictionary-loading-container');
    if (container) {
      container.style.display = 'none';
    }
  }

  updateLoadingProgress(percentage) {
    const bar = document.getElementById('dictionary-loading-bar');
    const percentageText = document.getElementById('dictionary-loading-percentage');
    
    if (bar) {
      bar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
    
    if (percentageText) {
      percentageText.textContent = `${Math.round(percentage)}%`;
    }
  }

  completeDictionaryLoadingBar() {
    const container = document.getElementById('dictionary-loading-container');
    const loadingText = container?.querySelector('.loading-text');
    
    if (container) {
      container.classList.add('complete');
      this.updateLoadingProgress(100);
      this.dictionaryLoaded = true;
      
      if (loadingText) {
        loadingText.textContent = 'Dictionary loaded!';
      }
      
      // If we're on the loading step, automatically proceed to popup tutorial step
      if (this.currentStep === 'loading') {
        setTimeout(() => {
          this.showStep('popup');
        }, 800);
      } else {
        // Hide after a delay if not on loading step
        setTimeout(() => {
          this.hideDictionaryLoadingBar();
        }, 2000);
      }
    }
  }

  startProgressTracking(languageCode) {
    // Clear any existing intervals
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.dictionaryCheckInterval) {
      clearInterval(this.dictionaryCheckInterval);
      this.dictionaryCheckInterval = null;
    }
    
    let simulatedProgress = 0;
    const maxProgress = 95; // Don't go to 100% until actually loaded
    
    // Simulate progress with smooth animation
    this.progressInterval = setInterval(() => {
      // Gradually increase progress
      if (simulatedProgress < maxProgress) {
        // Slow down as we approach max (ease-out curve)
        const increment = (maxProgress - simulatedProgress) * 0.05;
        simulatedProgress = Math.min(maxProgress, simulatedProgress + increment);
        this.updateLoadingProgress(simulatedProgress);
      }
    }, 100);
    
    // Check if dictionary is actually loaded
    const checkDictionaryLoaded = async () => {
      try {
        if (this.dictionaryBridge) {
          const isLoaded = await this.dictionaryBridge.isDictionaryLoaded();
          if (isLoaded) {
            // Dictionary is loaded, complete the progress
            if (this.progressInterval) {
              clearInterval(this.progressInterval);
              this.progressInterval = null;
            }
            if (this.dictionaryCheckInterval) {
              clearInterval(this.dictionaryCheckInterval);
              this.dictionaryCheckInterval = null;
            }
            this.completeDictionaryLoadingBar();
            return true;
          }
        }
      } catch (error) {
        // Ignore errors
      }
      return false;
    };
    
    // Check periodically if dictionary is loaded
    this.dictionaryCheckInterval = setInterval(async () => {
      const loaded = await checkDictionaryLoaded();
      if (loaded) {
        if (this.dictionaryCheckInterval) {
          clearInterval(this.dictionaryCheckInterval);
          this.dictionaryCheckInterval = null;
        }
      }
    }, 500);
  }

  async goToTutorial() {
    if (!this.selectedLanguage) {
      alert('Please select a language before continuing');
      return;
    }

    // Set language in vocab manager
    this.vocabManager.setCurrentLanguage(this.selectedLanguage.code);

    // Check if dictionary is loaded
    const isDictionaryLoaded = await this.checkDictionaryLoaded();
    
    if (!isDictionaryLoaded) {
      // Show loading step first
      this.showStep('loading');
      this.initializeLoadingStep();
    } else {
      // Dictionary already loaded, go directly to popup tutorial
      setTimeout(() => {
        this.showStep('popup');
      }, 100);
    }
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

    // Set up bulk import button
    const bulkImportBtn = document.getElementById('btn-bulk-import');
    if (bulkImportBtn) {
      bulkImportBtn.addEventListener('click', () => {
        this.handleBulkImport();
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

    // Complete onboarding and show success step
    try {
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
    }
  }

  async checkDictionaryLoaded() {
    try {
      if (this.dictionaryBridge) {
        return await this.dictionaryBridge.isDictionaryLoaded();
      }
      // If no bridge yet, assume not loaded
      return false;
    } catch (error) {
      console.warn('Error checking dictionary status:', error);
      return false;
    }
  }

  initializeLoadingStep() {
    // Update language name in loading step
    const loadingLanguageName = document.getElementById('loading-language-name');
    if (loadingLanguageName && this.selectedLanguage) {
      loadingLanguageName.textContent = this.selectedLanguage.name;
    }

    // Initialize progress bar (container is already visible in loading step)
    this.updateLoadingProgress(0);
    
    // Start progress tracking
    if (this.selectedLanguage) {
      this.startProgressTracking(this.selectedLanguage.code);
    }
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

  async handleBulkImport() {
    const textarea = document.getElementById('bulk-import-textarea');
    const text = textarea.value.trim();

    if (!text) {
      alert('Please enter some words to import.');
      return;
    }

    // Parse input text - split by various delimiters (same logic as settings)
    const words = text.split(/[\s,\n\r]+/).filter((word) => word.trim());

    if (words.length === 0) {
      alert('No valid words found. Please check your input.');
      return;
    }

    try {
      const importBtn = document.getElementById('btn-bulk-import');
      if (importBtn) {
        importBtn.textContent = 'Importing...';
        importBtn.disabled = true;
      }

      // Ensure vocab manager is loaded
      await this.vocabManager.loadKnownWords();
      
      // Import words using vocab manager (it will normalize and handle them)
      // Returns an object with newWordsCount and processedWordsCount
      const result = await this.vocabManager.markMultipleWordsAsKnown(words);
      const newWordsCount = result.newWordsCount;
      const processedWordsCount = result.processedWordsCount;
      const duplicatesCount = processedWordsCount - newWordsCount;

      textarea.value = '';

      let message = `Successfully imported ${newWordsCount} new word${newWordsCount !== 1 ? 's' : ''}!`;
      if (duplicatesCount > 0) {
        message += `\n${duplicatesCount} duplicate word${duplicatesCount !== 1 ? 's were' : ' was'} skipped.`;
      }
      message += `\n\nWords imported for language: ${this.selectedLanguage?.name || this.vocabManager.currentLanguage || 'current'}`;

      alert(message);
    } catch (error) {
      console.error('Error importing words:', error);
      alert('Error importing words. Please try again.');
    } finally {
      const importBtn = document.getElementById('btn-bulk-import');
      if (importBtn) {
        importBtn.innerHTML = '<span>📥</span> Import Words';
        importBtn.disabled = false;
      }
    }
  }


  startUsingExtension() {
    // Clear any intervals before closing
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.dictionaryCheckInterval) {
      clearInterval(this.dictionaryCheckInterval);
    }
    
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

    // Initialize popup system if showing popup step
    if (stepName === 'popup') {
      // Set sentence text immediately (before initialization)
      const sentenceElement = document.getElementById('onboarding-sentence');
      if (sentenceElement && this.selectedLanguage) {
        const sentence = this.getSampleSentence(this.selectedLanguage.code);
        sentenceElement.textContent = sentence;
        console.log('Sentence set:', sentence);
      }
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        this.initializePopupSystem();
      }, 100);
    }

    // Update progress indicator
    this.updateProgressIndicator(stepName);
  }

  updateProgressIndicator(stepName) {
    const dots = document.querySelectorAll('.progress-dot');

    // Map step names to indices (loading step is transitional, maps to same as popup)
    const stepIndex = {
      'hero': 0,
      'language': 1,
      'loading': 2, // Same as popup since it's transitional
      'popup': 2,
      'level': 3,
      'success': 4
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

  getSampleSentence(languageCode) {
    const sentences = {
      'zh': '我喜欢学习新的语言。',
      'es': 'Me gusta aprender nuevos idiomas.',
      'fr': "J'aime apprendre de nouvelles langues.",
      'en': 'I love learning new languages.'
    };
    return sentences[languageCode] || sentences['zh'];
  }

  async initializePopupSystem() {
    if (!this.selectedLanguage) {
      console.warn('Cannot initialize popup system: no language selected');
      return;
    }

    // Check if already initialized for this language
    if (this.popupSystemInitialized && 
        this.languageRegistry && 
        this.languageRegistry.getCurrentLanguage() === this.selectedLanguage.code) {
      console.log('Popup system already initialized for this language');
      return;
    }

    // If initialized for a different language, reset first
    if (this.popupSystemInitialized) {
      console.log('Reinitializing popup system for new language...');
      this.resetPopupSystem();
    }

    try {
      console.log('Initializing popup system for onboarding...');

      // Clean up any existing event listeners
      this.cleanupEventListeners();

      // Initialize language registry
      this.languageRegistry = new LanguageRegistry();
      this.languageRegistry.initializeDefaultAdapters();
      this.languageRegistry.setLanguage(this.selectedLanguage.code);

      // Initialize managers
      // Create new dictionaryBridge for new language
      this.dictionaryBridge = new DictionaryBridge();
      await this.dictionaryBridge.ensureOffscreenDocument();
      
      this.dictionaryManager = new DictionaryManagerProxy(this.languageRegistry);
      this.vocabManager = new VocabManager();
      this.vocabManager.setCurrentLanguage(this.selectedLanguage.code);
      this.highlightManager = new HighlightManager();
      this.frequencyManager = new FrequencyManager();

      // Load dictionary and resources
      // Dictionary may already be loading from language selection, but wait for it to complete
      await Promise.all([
        this.dictionaryManager.loadDictionary(),
        this.vocabManager.loadKnownWords(),
        this.frequencyManager.loadFrequencyList()
      ]);
      
      // Dictionary is now loaded, complete the progress bar if we're on the loading step
      if (this.currentStep === 'loading') {
        this.completeDictionaryLoadingBar();
      } else {
        this.dictionaryLoaded = true;
      }

      const originalInit = PageProcessor.prototype.initializeProcessing;
      PageProcessor.prototype.ensureGlobalCSS = function() {
        // Do nothing - prevent auto-processing
      };

      // Initialize page processor
      // Prevent auto-processing of the entire page - we only want popup functionality
      this.pageProcessor = new PageProcessor(
        this.dictionaryManager,
        this.vocabManager,
        this.languageRegistry
      );

      PageProcessor.prototype.ensureGlobalCSS = originalInit;
      
      // Override ALL processing methods to prevent any automatic underlining
      this.pageProcessor.processPageForUnknownWords = () => {
        // Do nothing - we don't want underlines on the onboarding page
        console.log('📝 Page processing disabled for onboarding');
      };

      this.pageProcessor.ensureGlobalCSS = () => {
        // Do nothing - we don't want to inject CSS for the onboarding page
      };
      
      this.pageProcessor.processTextNodeForUnknownWords = () => {
        // Do nothing - prevent processing of individual text nodes
        return Promise.resolve();
      };
      
      // Override initializeProcessing to prevent it from calling processPageForUnknownWords
      this.pageProcessor.initializeProcessing = () => {
        // Only inject CSS and set up subtitle listeners, but don't process the page
        this.pageProcessor.ensureGlobalCSS();
        this.pageProcessor.setupSubtitleEventListeners();
        // Don't call processPageForUnknownWords() - we don't want underlines
        console.log('📝 PageProcessor initialized for onboarding (no auto-processing)');
      };
      
      // Override getCharacterAtPosition to ignore spaces and only work in sentence container
      const originalGetCharacterAtPosition = this.pageProcessor.getCharacterAtPosition.bind(this.pageProcessor);
      this.pageProcessor.getCharacterAtPosition = (event) => {
        // Only allow lookups in the sentence container
        const sentenceContainer = document.getElementById('onboarding-sentence-container');
        const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
        
        if (!sentenceContainer || !sentenceContainer.contains(elementAtPoint)) {
          return null; // Don't process anything outside the sentence container
        }
        
        // Check if hovering over whitespace - if so, ignore
        if (elementAtPoint) {
          const text = elementAtPoint.textContent || '';
          const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
          if (range) {
            const char = range.toString() || text[range.startOffset] || '';
            if (/^\s+$/.test(char)) {
              return null; // Ignore spaces
            }
          }
        }
        
        // Get character info
        const result = originalGetCharacterAtPosition(event);
        
        // If result is a space or whitespace, ignore it
        if (result && result.word && /^\s+$/.test(result.word.trim())) {
          return null;
        }
        
        return result;
      };
      
      // Ensure CSS is injected (in case initialization already ran)
      if (!this.pageProcessor.injectedCSS) {
        this.pageProcessor.ensureGlobalCSS();
      }
      
      // Remove any underlines that might have been created during initialization
      // (in case the constructor already processed the page)
      // Run multiple times to catch any that appear later
      const removeUnderlines = () => {
        const underlinedWords = document.querySelectorAll('.chinese-unknown-word, .unknown-word');
        let removedCount = 0;
        
        underlinedWords.forEach(word => {
          // Remove the underline class but keep the text
          const parent = word.parentNode;
          if (parent) {
            const text = word.textContent;
            const textNode = document.createTextNode(text);
            parent.replaceChild(textNode, word);
            // Normalize to merge adjacent text nodes
            parent.normalize();
            removedCount++;
          }
        });
        
        if (removedCount > 0) {
          console.log(`📝 Removed ${removedCount} underlines from onboarding page`);
        }
      };
      
      // Remove immediately and also check periodically
      setTimeout(removeUnderlines, 50);
      setTimeout(removeUnderlines, 200);
      setTimeout(removeUnderlines, 500);
      
      // Also set up a mutation observer to catch any new underlines
      const observer = new MutationObserver(() => {
        removeUnderlines();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Stop observing after a while
      setTimeout(() => {
        observer.disconnect();
      }, 2000);

      // Initialize popup manager
      this.popupManager = new MultiCardPopupManager({
        highlightManager: this.highlightManager,
        dictionaryManager: this.dictionaryManager,
        vocabManager: this.vocabManager,
        frequencyManager: this.frequencyManager,
        languageRegistry: this.languageRegistry
      });

      // Initialize activation controller
      this.activationController = new ActivationController('Shift');

      // Override highlight manager to preserve spacing in onboarding sentence
      const originalHighlightLookupText = this.highlightManager.highlightLookupText.bind(this.highlightManager);
      this.highlightManager.highlightLookupText = (node, start, end) => {
        // Check if we're in the onboarding sentence container
        const sentenceContainer = document.getElementById('onboarding-sentence-container');
        const isInSentenceContainer = sentenceContainer && sentenceContainer.contains(node);
        
        if (isInSentenceContainer) {
          // For onboarding, use a version that preserves spacing better
          this.highlightManager.removeLookupHighlight();
          
          if (!node || start === end || !node.parentNode) return;
          
          const text = node.textContent;
          const before = text.slice(0, start);
          const target = text.slice(start, end);
          const after = text.slice(end);
          
          // Create nodes preserving all spacing
          const beforeNode = document.createTextNode(before);
          const highlightSpan = document.createElement('span');
          highlightSpan.className = 'lookup-highlight';
          highlightSpan.style.display = 'inline';
          highlightSpan.style.padding = '0';
          highlightSpan.style.margin = '0';
          highlightSpan.textContent = target;
          const afterNode = document.createTextNode(after);
          
          const parent = node.parentNode;
          const fragment = document.createDocumentFragment();
          fragment.appendChild(beforeNode);
          fragment.appendChild(highlightSpan);
          fragment.appendChild(afterNode);
          
          parent.insertBefore(fragment, node);
          parent.removeChild(node);
          
          this.highlightManager.currentHighlight = highlightSpan;
          this.highlightManager.isMouseOverHighlight = true;
          
          highlightSpan.addEventListener('mouseenter', () => {
            this.highlightManager.isMouseOverHighlight = true;
          });
          
          highlightSpan.addEventListener('mouseleave', () => {
            this.highlightManager.isMouseOverHighlight = false;
            if (window.popupManager) {
              window.popupManager.scheduleHidePopup();
            }
          });
        } else {
          // Use original method for other elements
          originalHighlightLookupText(node, start, end);
        }
      };
      
      // Initialize lookup controller
      this.lookupController = new LookupController({
        pageProcessor: this.pageProcessor,
        highlightManager: this.highlightManager,
        popup: this.popupManager,
        activation: this.activationController
      });

      // Set up event listeners for Shift key (store references for cleanup)
      this.eventHandlers.keydown = (e) => {
        if (this.activationController && this.lookupController) {
          this.activationController.handleKeyDown(e, {
            onActivate: () => {
              this.activationController.toggleActivationMode(true);
              if (this.lookupController.lastPointerEvent) {
                this.lookupController.onPointerMove(this.lookupController.lastPointerEvent);
              }
            }
          });
        }
      };
      document.addEventListener('keydown', this.eventHandlers.keydown);

      this.eventHandlers.keyup = (e) => {
        if (this.activationController && this.lookupController) {
          this.activationController.handleKeyUp(e, {
            onDeactivate: () => {
              this.activationController.toggleActivationMode(false);
              this.lookupController.onDeactivate();
            }
          });
        }
      };
      document.addEventListener('keyup', this.eventHandlers.keyup);

      // Set up pointer move listener
      this.eventHandlers.pointermove = (e) => {
        if (this.lookupController) {
          this.lookupController.onPointerMove(e);
        }
      };
      document.addEventListener('pointermove', this.eventHandlers.pointermove);

      // Set up click listener
      this.eventHandlers.click = (e) => {
        if (this.lookupController) {
          this.lookupController.onClick(e);
        }
      };
      document.addEventListener('click', this.eventHandlers.click);

      this.popupSystemInitialized = true;
      console.log('✅ Popup system initialized');

      // Set up the interactive sentence
      this.setupInteractiveSentence();
    } catch (error) {
      console.error('Error initializing popup system:', error);
    }
  }

  setupInteractiveSentence() {
    const container = document.getElementById('onboarding-sentence-container');
    const sentenceElement = document.getElementById('onboarding-sentence');
    
    if (!container || !sentenceElement) {
      console.warn('Sentence container not found', { container, sentenceElement });
      // Retry after a short delay
      setTimeout(() => {
        this.setupInteractiveSentence();
      }, 200);
      return;
    }

    // Get sample sentence for selected language
    const sentence = this.getSampleSentence(this.selectedLanguage.code);
    console.log('Setting up sentence:', sentence, 'for language:', this.selectedLanguage.code);
    sentenceElement.textContent = sentence;

    // Note: We don't process the sentence for underlines - we just want popup functionality
    // The popup will work via LookupController which uses PageProcessor.getCharacterAtPosition
    // which doesn't require pre-processing. Users can hold Shift and hover to see popups.
    console.log('✅ Sentence ready for popup interaction (no underlines)');
  }

  getAllTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }
    return textNodes;
  }

  setupInteractiveDemo() {
    // This is now handled by the real popup system in initializePopupSystem
    // Keeping this method for compatibility but it's no longer needed
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

