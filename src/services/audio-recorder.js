/**
 * Audio Recorder Service
 * Handles audio recording from video content for Anki cards
 * Records sentence audio based on subtitle timing
 */

class AudioRecorder {
    constructor() {
        this.recording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
    }

    /**
     * Record audio from video element for a specific duration
     * @param {HTMLVideoElement} videoElement - The video element to record from
     * @param {number} duration - Duration in milliseconds
     * @param {number} paddingBefore - Padding before in seconds (default: 0.25)
     * @param {number} paddingAfter - Padding after in seconds (default: 0.25)
     * @returns {Promise<string|null>} Base64 data URL of recorded audio
     */
    async recordFromVideo(videoElement, duration, paddingBefore = 0.25, paddingAfter = 0.25) {
        if (!videoElement) {
            console.error('[Helios Audio] No video element provided');
            return null;
        }

        if (this.recording) {
            console.warn('[Helios Audio] Already recording, please wait');
            return null;
        }

        try {
            // Check if video element supports captureStream
            if (typeof videoElement.captureStream !== 'function' &&
                typeof videoElement.mozCaptureStream !== 'function') {
                console.error('[Helios Audio] Video element does not support captureStream');
                return this.recordFromTab(duration + (paddingBefore + paddingAfter) * 1000);
            }

            // Capture stream from video element
            const stream = this.captureVideoStream(videoElement);
            if (!stream) {
                return null;
            }

            // Calculate total duration with padding
            const totalDuration = duration + (paddingBefore + paddingAfter) * 1000;

            // Record the audio
            const audioDataUrl = await this.recordStream(stream, totalDuration);

            return audioDataUrl;

        } catch (error) {
            console.error('[Helios Audio] Error recording from video:', error);
            return null;
        }
    }

    /**
     * Capture audio stream from video element
     * @param {HTMLVideoElement} videoElement
     * @returns {MediaStream|null}
     */
    captureVideoStream(videoElement) {
        try {
            let stream = null;

            // Try Chrome API
            if (typeof videoElement.captureStream === 'function') {
                stream = videoElement.captureStream();
            }
            // Try Firefox API
            else if (typeof videoElement.mozCaptureStream === 'function') {
                stream = videoElement.mozCaptureStream();
            }

            if (!stream) {
                console.error('[Helios Audio] Failed to capture stream from video');
                return null;
            }

            // Extract only audio tracks
            const audioStream = new MediaStream();

            // Remove video tracks
            stream.getVideoTracks().forEach(track => {
                track.stop();
            });

            // Add audio tracks
            stream.getAudioTracks().forEach(track => {
                if (track.enabled) {
                    audioStream.addTrack(track);
                }
            });

            if (audioStream.getAudioTracks().length === 0) {
                console.error('[Helios Audio] No audio tracks available in stream');
                return null;
            }

            // Route audio to speakers to maintain playback
            this.routeToSpeakers(audioStream);

            console.log('[Helios Audio] Successfully captured audio stream from video');
            return audioStream;

        } catch (error) {
            console.error('[Helios Audio] Error capturing video stream:', error);
            return null;
        }
    }

    /**
     * Route audio stream to speakers so user can still hear
     * @param {MediaStream} stream
     */
    routeToSpeakers(stream) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.audioContext.destination);

        } catch (error) {
            console.warn('[Helios Audio] Could not route to speakers:', error);
            // Non-critical, continue anyway
        }
    }

    /**
     * Record from MediaStream for specified duration
     * @param {MediaStream} stream
     * @param {number} duration - Duration in milliseconds
     * @returns {Promise<string|null>}
     */
    recordStream(stream, duration) {
        return new Promise((resolve) => {
            try {
                this.recording = true;
                this.audioChunks = [];

                // Create MediaRecorder
                // Use WebM Opus for better compression
                const mimeType = this.getSupportedMimeType();
                this.mediaRecorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    audioBitsPerSecond: 128000 // 128 kbps
                });

                // Collect data chunks
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                // Handle recording stop
                this.mediaRecorder.onstop = async () => {
                    this.recording = false;

                    try {
                        // Create blob from chunks
                        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

                        // Convert to base64 data URL
                        const dataUrl = await this.blobToDataUrl(audioBlob);

                        // Stop all tracks
                        stream.getTracks().forEach(track => track.stop());

                        console.log('[Helios Audio] Recording complete, size:', audioBlob.size, 'bytes');
                        resolve(dataUrl);

                    } catch (error) {
                        console.error('[Helios Audio] Error processing recorded audio:', error);
                        resolve(null);
                    }
                };

                // Handle errors
                this.mediaRecorder.onerror = (error) => {
                    console.error('[Helios Audio] MediaRecorder error:', error);
                    this.recording = false;
                    resolve(null);
                };

                // Start recording
                this.mediaRecorder.start();
                console.log('[Helios Audio] Recording started, duration:', duration, 'ms');

                // Stop after duration
                setTimeout(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                    }
                }, duration);

            } catch (error) {
                console.error('[Helios Audio] Error starting recording:', error);
                this.recording = false;
                resolve(null);
            }
        });
    }

    /**
     * Get supported MIME type for recording
     * @returns {string}
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return ''; // Let browser choose default
    }

    /**
     * Convert Blob to base64 data URL
     * @param {Blob} blob
     * @returns {Promise<string>}
     */
    blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Record from tab capture (fallback for DRM content)
     * @param {number} duration - Duration in milliseconds
     * @returns {Promise<string|null>}
     */
    async recordFromTab(duration) {
        try {
            console.log('[Helios Audio] Requesting tab capture for audio recording');

            const response = await chrome.runtime.sendMessage({
                action: 'CAPTURE_TAB_AUDIO',
                duration: duration
            });

            if (response && response.success) {
                console.log('[Helios Audio] Tab audio captured successfully');
                return response.dataUrl;
            } else {
                console.error('[Helios Audio] Failed to capture tab audio:', response?.error);
                return null;
            }

        } catch (error) {
            console.error('[Helios Audio] Error requesting tab audio capture:', error);
            return null;
        }
    }

    /**
     * Stop any ongoing recording
     */
    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        this.recording = false;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.HeliosAudioRecorder = new AudioRecorder();
}
