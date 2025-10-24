/**
 * Onboarding Controller
 * Orchestrates the onboarding flow and language selection
 */

class OnboardingController {
  constructor() {
    this.firstRunDetector = new FirstRunDetector();
    this.selectedLanguage = null;
  }

  /**
   * Check if onboarding should be shown
   * @returns {Promise<boolean>}
   */
  async shouldShowOnboarding() {
    return !(await this.firstRunDetector.hasCompletedOnboarding());
  }

  /**
   * Save language selection and complete onboarding
   * @param {string} languageCode - Selected language code
   * @returns {Promise<void>}
   */
  async completeOnboarding(languageCode) {
    if (!languageCode) {
      throw new Error('Language code is required to complete onboarding');
    }

    try {
      // Save language preference to storage
      await chrome.storage.local.set({
        targetLanguage: languageCode
      });

      // Mark onboarding as complete
      await this.firstRunDetector.markOnboardingComplete();

      // Notify background script about language selection
      // This will reload settings on all open tabs
      if (chrome.runtime && chrome.runtime.sendMessage) {
        await chrome.runtime.sendMessage({
          action: 'onboardingCompleted',
          language: languageCode
        });
      }

      console.log(`✅ Onboarding completed with language: ${languageCode}`);
      console.log('Settings saved to storage. Extension is ready to use!');
      return true;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  }

  /**
   * Get current language from storage
   * @returns {Promise<string|null>}
   */
  async getCurrentLanguage() {
    try {
      const result = await chrome.storage.local.get('targetLanguage');
      return result.targetLanguage || null;
    } catch (error) {
      console.error('Error getting current language:', error);
      return null;
    }
  }

  /**
   * Open onboarding page
   */
  openOnboardingPage() {
    const onboardingUrl = chrome.runtime.getURL('src/ui/onboarding/onboarding.html');
    chrome.tabs.create({ url: onboardingUrl });
  }

  /**
   * Redirect to main extension page after onboarding
   */
  redirectToExtension() {
    // Close onboarding tab and open settings or popup
    const settingsUrl = chrome.runtime.getURL('src/ui/settings/helios-settings.html');
    chrome.tabs.create({ url: settingsUrl }, () => {
      // Close current onboarding tab
      chrome.tabs.getCurrent((tab) => {
        if (tab) {
          chrome.tabs.remove(tab.id);
        }
      });
    });
  }
}

// Export
if (typeof window !== 'undefined') {
  window.OnboardingController = OnboardingController;
}
