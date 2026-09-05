/**
 * First Run Detector
 * Detects if this is the user's first time using the extension
 */

export class FirstRunDetector {
  ONBOARDING_KEY: string;
  INSTALL_DATE_KEY: string;

  constructor() {
    this.ONBOARDING_KEY = 'hasCompletedOnboarding';
    this.INSTALL_DATE_KEY = 'installDate';
  }

  /**
   * Check if onboarding has been completed
   */
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(this.ONBOARDING_KEY);
      return result[this.ONBOARDING_KEY] === true;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Mark onboarding as completed
   */
  async markOnboardingComplete(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.ONBOARDING_KEY]: true,
        onboardingCompletedDate: new Date().toISOString()
      });
      console.log('Onboarding marked as complete');
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  }

  /**
   * Reset onboarding status (for testing)
   */
  async resetOnboarding(): Promise<void> {
    try {
      await chrome.storage.local.remove([
        this.ONBOARDING_KEY,
        'onboardingCompletedDate'
      ]);
      console.log('Onboarding status reset');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  }

  /**
   * Get install date
   */
  async getInstallDate(): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(this.INSTALL_DATE_KEY);
      return result[this.INSTALL_DATE_KEY] || null;
    } catch (error) {
      console.error('Error getting install date:', error);
      return null;
    }
  }

  /**
   * Set install date
   */
  async setInstallDate(): Promise<void> {
    try {
      const existing = await this.getInstallDate();
      if (!existing) {
        await chrome.storage.local.set({
          [this.INSTALL_DATE_KEY]: new Date().toISOString()
        });
        console.log('Install date recorded');
      }
    } catch (error) {
      console.error('Error setting install date:', error);
    }
  }

  /**
   * Check if this is a fresh install
   */
  async isFreshInstall(): Promise<boolean> {
    const completed = await this.hasCompletedOnboarding();
    const installDate = await this.getInstallDate();
    return !completed && !installDate;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.FirstRunDetector = FirstRunDetector;
}
