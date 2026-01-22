/**
 * Screenshot Capturer Service
 * Handles screenshot capture from video content for Anki cards
 */

class ScreenshotCapturer {
    constructor() {
        this.capturing = false;
    }

    /**
     * Capture screenshot from content script side
     * Uses canvas to capture video frame directly (no permissions needed)
     * @returns {Promise<string|null>} Base64 data URL of screenshot or null on error
     */
    async captureScreenshot() {
        if (this.capturing) {
            console.warn('[Helios Screenshot] Already capturing, please wait');
            return null;
        }

        this.capturing = true;

        try {
            // Find video element to capture from
            const videoElement = this.findVideoElement();

            if (!videoElement) {
                console.error('[Helios Screenshot] No video element found');
                return null;
            }

            // Capture video frame using canvas
            const dataUrl = this.captureVideoFrame(videoElement);

            if (dataUrl) {
                console.log('[Helios Screenshot] Screenshot captured successfully from video');
                return dataUrl;
            } else {
                console.error('[Helios Screenshot] Failed to capture video frame');
                return null;
            }
        } catch (error) {
            console.error('[Helios Screenshot] Error capturing screenshot:', error);
            return null;
        } finally {
            this.capturing = false;
        }
    }

    /**
     * Capture current frame from video element using canvas
     * @param {HTMLVideoElement} videoElement
     * @returns {string|null} Base64 data URL
     */
    captureVideoFrame(videoElement) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // Convert to JPEG for smaller size
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

            console.log('[Helios Screenshot] Captured frame:', canvas.width, 'x', canvas.height);
            return dataUrl;
        } catch (error) {
            console.error('[Helios Screenshot] Error capturing video frame:', error);
            return null;
        }
    }

    /**
     * Capture and crop screenshot to video element bounds
     * @param {HTMLVideoElement} videoElement - The video element to crop to
     * @returns {Promise<string|null>} Base64 data URL of cropped screenshot
     */
    async captureAndCropToVideo(videoElement) {
        if (!videoElement) {
            console.warn('[Helios Screenshot] No video element provided');
            return this.captureScreenshot();
        }

        try {
            // First capture the full tab
            const fullScreenshot = await this.captureScreenshot();
            if (!fullScreenshot) {
                return null;
            }

            // Get video element bounds
            const rect = videoElement.getBoundingClientRect();
            const devicePixelRatio = window.devicePixelRatio || 1;

            // Crop the screenshot to video bounds
            const croppedDataUrl = await this.cropImage(
                fullScreenshot,
                {
                    x: rect.left * devicePixelRatio,
                    y: rect.top * devicePixelRatio,
                    width: rect.width * devicePixelRatio,
                    height: rect.height * devicePixelRatio
                },
                devicePixelRatio
            );

            return croppedDataUrl;
        } catch (error) {
            console.error('[Helios Screenshot] Error cropping to video:', error);
            // Fallback to full screenshot
            return this.captureScreenshot();
        }
    }

    /**
     * Crop image using canvas
     * @param {string} dataUrl - Source image data URL
     * @param {Object} rect - Crop rectangle {x, y, width, height}
     * @param {number} pixelRatio - Device pixel ratio
     * @returns {Promise<string>} Cropped image data URL
     */
    cropImage(dataUrl, rect, pixelRatio) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                try {
                    // Create canvas with exact crop dimensions
                    const canvas = document.createElement('canvas');
                    canvas.width = rect.width;
                    canvas.height = rect.height;

                    const ctx = canvas.getContext('2d');

                    // Draw cropped portion
                    ctx.drawImage(
                        img,
                        rect.x, rect.y,           // Source x, y
                        rect.width, rect.height,   // Source width, height
                        0, 0,                      // Dest x, y
                        rect.width, rect.height    // Dest width, height
                    );

                    // Convert to data URL (JPEG for smaller size)
                    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
                    resolve(croppedDataUrl);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = (error) => {
                reject(new Error('Failed to load image for cropping'));
            };

            img.src = dataUrl;
        });
    }

    /**
     * Find the active video element on the page
     * @returns {HTMLVideoElement|null}
     */
    findVideoElement() {
        // Try to find the main video element
        const videos = document.querySelectorAll('video');

        if (videos.length === 0) {
            return null;
        }

        // If only one video, return it
        if (videos.length === 1) {
            return videos[0];
        }

        // Find the largest, playing video
        let largestVideo = null;
        let largestArea = 0;

        for (const video of videos) {
            // Skip hidden videos
            if (video.offsetWidth === 0 || video.offsetHeight === 0) {
                continue;
            }

            const area = video.offsetWidth * video.offsetHeight;

            // Prefer playing videos
            if (!video.paused || !largestVideo) {
                if (area > largestArea || (!largestVideo.paused && video.paused)) {
                    largestVideo = video;
                    largestArea = area;
                }
            }
        }

        return largestVideo;
    }

    /**
     * Capture screenshot intelligently - captures video frame directly
     * @returns {Promise<string|null>}
     */
    async captureIntelligent() {
        const videoElement = this.findVideoElement();

        if (videoElement) {
            console.log('[Helios Screenshot] Found video element, capturing frame');
            return this.captureScreenshot();
        } else {
            console.log('[Helios Screenshot] No video element found');
            return null;
        }
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.HeliosScreenshotCapturer = new ScreenshotCapturer();
}
