/**
 * Onboarding Controller
 * Orchestrates the onboarding flow and language selection
 */

import { browser } from 'wxt/browser';
import { FirstRunDetector } from '@/content/onboarding/first-run-detector';
import { items, storage } from '@/config/storage';

export class OnboardingController {
  firstRunDetector: FirstRunDetector;
  selectedLanguage: string | null;

  constructor() {
    this.firstRunDetector = new FirstRunDetector();
    this.selectedLanguage = null;
  }

  /**
   * Check if onboarding should be shown
   */
  async shouldShowOnboarding(): Promise<boolean> {
    return !(await this.firstRunDetector.hasCompletedOnboarding());
  }

  /**
   * Save language selection and complete onboarding
   * @param languageCode - Selected language code
   * @param nativeLanguageCode - Selected native language code (optional)
   */
  async completeOnboarding(languageCode: string, nativeLanguageCode: string | null = null): Promise<boolean> {
    if (!languageCode) {
      throw new Error('Language code is required to complete onboarding');
    }

    try {
      // Save language preferences and mark onboarding complete atomically
      // This prevents race conditions where setupInitialData might run between saves
      const settingsToSave: Parameters<typeof storage.setItems>[0] = [
        { item: items.targetLanguage, value: languageCode },
        { item: items.hasCompletedOnboarding, value: true },
        { item: items.onboardingCompletedDate, value: new Date().toISOString() }
      ];

      // Only save native language if provided (not Chinese, which doesn't need it)
      if (nativeLanguageCode) {
        settingsToSave.push({ item: items.nativeLanguage, value: nativeLanguageCode });
      }

      // Save everything in a single atomic operation
      await storage.setItems(settingsToSave);

      // Notify background script about language selection
      // This will reload settings on all open tabs
      if (browser.runtime?.id) {
        await browser.runtime.sendMessage({
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
   */
  async getCurrentLanguage(): Promise<string | null> {
    try {
      return (await items.targetLanguage.getValue()) || null;
    } catch (error) {
      console.error('Error getting current language:', error);
      return null;
    }
  }

  /**
   * Open onboarding page
   */
  openOnboardingPage(): void {
    const onboardingUrl = browser.runtime.getURL('/onboarding.html');
    browser.tabs.create({ url: onboardingUrl });
  }

  /**
   * Redirect to main extension page after onboarding
   */
  redirectToExtension(): void {
    // Close onboarding tab and open settings or popup
    const settingsUrl = browser.runtime.getURL('/options.html');
    browser.tabs.create({ url: settingsUrl }, () => {
      // Close current onboarding tab
      browser.tabs.getCurrent((tab) => {
        if (tab) {
          browser.tabs.remove(tab.id!);
        }
      });
    });
  }
}
