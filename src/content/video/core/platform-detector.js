/**
 * Platform Detector
 * Identifies which streaming platform the user is on
 */
class PlatformDetector {
  /**
   * Detect current streaming platform
   * @returns {string} Platform name: 'youtube', 'netflix', 'disneyplus', 'prime', 'hulu', 'hbo', 'crunchyroll', or null
   */
  static detectPlatform() {
    const hostname = window.location.hostname.toLowerCase();

    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube';
    }

    // Netflix
    if (hostname.includes('netflix.com')) {
      return 'netflix';
    }

    // Disney Plus
    if (hostname.includes('disneyplus.com') || hostname.includes('disney')) {
      return 'disneyplus';
    }

    // Amazon Prime Video
    if (hostname.includes('amazon.com') || hostname.includes('primevideo.com')) {
      return 'prime';
    }

    // Hulu
    if (hostname.includes('hulu.com')) {
      return 'hulu';
    }

    // HBO Max / Max
    if (hostname.includes('hbomax.com') || hostname.includes('max.com')) {
      return 'hbo';
    }

    // Crunchyroll
    if (hostname.includes('crunchyroll.com')) {
      return 'crunchyroll';
    }

    // Funimation
    if (hostname.includes('funimation.com')) {
      return 'funimation';
    }

    // VRV
    if (hostname.includes('vrv.co')) {
      return 'vrv';
    }

    return null;
  }

  /**
   * Check if current page is a supported streaming platform
   * @returns {boolean}
   */
  static isSupportedPlatform() {
    return this.detectPlatform() !== null;
  }

  /**
   * Get platform display name
   * @param {string} platform - Platform identifier
   * @returns {string}
   */
  static getPlatformName(platform) {
    const names = {
      'youtube': 'YouTube',
      'netflix': 'Netflix',
      'disneyplus': 'Disney+',
      'prime': 'Amazon Prime Video',
      'hulu': 'Hulu',
      'hbo': 'HBO Max',
      'crunchyroll': 'Crunchyroll',
      'funimation': 'Funimation',
      'vrv': 'VRV'
    };

    return names[platform] || 'Unknown';
  }
}
