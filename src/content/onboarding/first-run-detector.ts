/**
 * First Run Detector
 * Detects if this is the user's first time using the extension
 */

import { items, storage } from '@/config/storage';

export class FirstRunDetector {
  /**
   * Check if onboarding has been completed
   */
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      return (await items.hasCompletedOnboarding.getValue()) === true;
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
      await storage.setItems([
        { item: items.hasCompletedOnboarding, value: true },
        { item: items.onboardingCompletedDate, value: new Date().toISOString() }
      ]);
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
      await storage.removeItems([
        items.hasCompletedOnboarding,
        items.onboardingCompletedDate
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
      return (await items.installDate.getValue()) || null;
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
        await items.installDate.setValue(new Date().toISOString());
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
