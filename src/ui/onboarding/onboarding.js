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

    this.init();
  }

  async init() {
    console.log('Initializing onboarding page...');

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

    // Show hero step
    this.showStep('hero');
  }

  setupEventListeners() {
    // Step 1: Hero - Get Started button
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.showStep('popup');
    });

    // Step 2: Popup feature - Back/Next buttons
    document.getElementById('btn-popup-back')?.addEventListener('click', () => {
      this.showStep('hero');
    });
    document.getElementById('btn-popup-next')?.addEventListener('click', () => {
      this.showStep('banner');
    });

    // Step 3: Banner feature - Back/Next buttons
    document.getElementById('btn-banner-back')?.addEventListener('click', () => {
      this.showStep('popup');
    });
    document.getElementById('btn-banner-next')?.addEventListener('click', () => {
      this.showStep('highlighting');
    });

    // Step 4: Highlighting feature - Back/Next buttons
    document.getElementById('btn-highlight-back')?.addEventListener('click', () => {
      this.showStep('banner');
    });
    document.getElementById('btn-highlight-next')?.addEventListener('click', () => {
      this.goToLanguageSelection();
    });

    // Step 5: Language selection - Back/Finish buttons
    document.getElementById('btn-lang-back')?.addEventListener('click', () => {
      this.showStep('highlighting');
    });
    document.getElementById('btn-finish')?.addEventListener('click', () => {
      this.completeOnboarding();
    });

    // Step 6: Success - Start Learning button
    document.getElementById('btn-start-learning')?.addEventListener('click', () => {
      this.startUsingExtension();
    });
  }

  goToLanguageSelection() {
    this.showStep('language');
    this.initializeLanguageSelector();
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

    // Enable finish button
    const finishBtn = document.getElementById('btn-finish');
    if (finishBtn) {
      finishBtn.disabled = false;
    }
  }

  async completeOnboarding() {
    if (!this.selectedLanguage) {
      alert('Please select a language before continuing');
      return;
    }

    try {
      // Show loading state
      const finishBtn = document.getElementById('btn-finish');
      if (finishBtn) {
        finishBtn.textContent = 'Setting up...';
        finishBtn.disabled = true;
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
      const finishBtn = document.getElementById('btn-finish');
      if (finishBtn) {
        finishBtn.textContent = 'Complete Setup';
        finishBtn.disabled = false;
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

    // Map step names to indices (6-step flow)
    const stepIndex = {
      'hero': 0,
      'popup': 1,
      'banner': 2,
      'highlighting': 3,
      'language': 4,
      'success': 5
    };

    const currentIndex = stepIndex[stepName];

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
