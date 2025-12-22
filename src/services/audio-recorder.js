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
     * @param {number|null} startTime - Time to seek to before recording (in seconds), or null for current position
     * @returns {Promise<string|null>} Base64 data URL of recorded audio
     */
    async recordFromVideo(videoElement, duration, paddingBefore = 0.25, paddingAfter = 0.25, startTime = null) {
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

            // Save original state
            const originalTime = videoElement.currentTime;
            const wasPaused = videoElement.paused;
            console.log('[Helios Audio] Original state - time:', originalTime, 'paused:', wasPaused);

            // Seek to start time if provided (already includes paddingBefore)
            if (startTime !== null) {
                const seekToTime = Math.max(0, startTime);
                console.log('[Helios Audio] Seeking to start time:', seekToTime, 's');
                videoElement.currentTime = seekToTime;
                // Wait for seek to complete
                await new Promise(resolve => {
                    const onSeeked = () => {
                        videoElement.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    videoElement.addEventListener('seeked', onSeeked);
                });
            }

            // CRITICAL: Video must be PLAYING for captureStream to record audio (like asbplayer)
            if (wasPaused) {
                console.log('[Helios Audio] Video was paused, starting playback for recording');
                await videoElement.play();
            }

            // Capture stream from video element AFTER starting playback
            const stream = this.captureVideoStream(videoElement);
            if (!stream) {
                return null;
            }

            // Calculate total duration with paddingAfter only (paddingBefore already applied in seek)
            const totalDuration = duration + (paddingAfter * 1000);
            console.log('[Helios Audio] Recording for duration:', totalDuration, 'ms');

            // Record the audio
            const audioDataUrl = await this.recordStream(stream, totalDuration);

            // Restore original state
            if (startTime !== null) {
                console.log('[Helios Audio] Restoring original position:', originalTime);
                videoElement.currentTime = originalTime;
            }

            if (wasPaused) {
                console.log('[Helios Audio] Restoring pause state');
                videoElement.pause();
            }

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
            console.log('[Helios Audio] Video state - paused:', videoElement.paused, 'muted:', videoElement.muted, 'currentTime:', videoElement.currentTime);

            let stream = null;

            // Try Chrome API
            if (typeof videoElement.captureStream === 'function') {
                stream = videoElement.captureStream();
                console.log('[Helios Audio] Using Chrome captureStream API');
            }
            // Try Firefox API
            else if (typeof videoElement.mozCaptureStream === 'function') {
                stream = videoElement.mozCaptureStream();
                console.log('[Helios Audio] Using Firefox mozCaptureStream API');
            }

            if (!stream) {
                console.error('[Helios Audio] Failed to capture stream from video - API not available');
                return null;
            }

            console.log('[Helios Audio] Stream captured, video tracks:', stream.getVideoTracks().length, 'audio tracks:', stream.getAudioTracks().length);

            // Check if we have audio tracks
            if (stream.getAudioTracks().length === 0) {
                console.error('[Helios Audio] No audio tracks available in stream');
                return null;
            }

            // Create new MediaStream with only audio tracks (like asbplayer)
            const audioStream = new MediaStream();

            // Stop video tracks
            for (const track of stream.getVideoTracks()) {
                track.stop();
            }

            // Add only enabled audio tracks
            for (const track of stream.getAudioTracks()) {
                if (track.enabled) {
                    audioStream.addTrack(track);
                }
            }

            // Log audio track details
            const audioTrack = audioStream.getAudioTracks()[0];
            console.log('[Helios Audio] Audio track details:', {
                id: audioTrack.id,
                kind: audioTrack.kind,
                label: audioTrack.label,
                enabled: audioTrack.enabled,
                muted: audioTrack.muted,
                readyState: audioTrack.readyState
            });

            // CRITICAL: Route audio to speakers using AudioContext (like asbplayer)
            // This must be done HERE in captureStream, not later in recordStream
            try {
                const output = new AudioContext();
                const source = output.createMediaStreamSource(audioStream);
                source.connect(output.destination);
                console.log('[Helios Audio] Audio routed to AudioContext in captureStream');
            } catch (error) {
                console.warn('[Helios Audio] Could not route to AudioContext:', error);
            }

            console.log('[Helios Audio] Successfully captured audio stream from video');
            return audioStream;

        } catch (error) {
            console.error('[Helios Audio] Error capturing video stream:', error);
            console.error('[Helios Audio] Error stack:', error.stack);
            return null;
        }
    }

    /**
     * Route audio stream to speakers so user can still hear
     * @param {MediaStream} stream
     */
    routeToSpeakers(stream) {
        try {
            // Skip routing - it can interfere with recording
            // The video element is already playing audio to speakers
            console.log('[Helios Audio] Audio already playing through video element');

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

                // Create MediaRecorder WITHOUT options - let browser choose best format
                // This is how asbplayer does it
                this.mediaRecorder = new MediaRecorder(stream);

                // Collect data chunks
                this.mediaRecorder.ondataavailable = (event) => {
                    console.log('[Helios Audio] ondataavailable fired, data size:', event.data?.size || 0);
                    if (event.data && event.data.size > 0) {
                        this.audioChunks.push(event.data);
                        console.log('[Helios Audio] Added chunk, total chunks:', this.audioChunks.length);
                    }
                };

                // Handle recording stop (onstop fires when stop() is called)
                this.mediaRecorder.onstop = async () => {
                    this.recording = false;

                    try {
                        console.log('[Helios Audio] Recording stopped, collected chunks:', this.audioChunks.length);

                        if (this.audioChunks.length === 0) {
                            console.error('[Helios Audio] No audio chunks collected');
                            resolve(null);
                            return;
                        }

                        // Create blob from chunks (use mimeType from MediaRecorder)
                        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });

                        console.log('[Helios Audio] Created blob, size:', audioBlob.size, 'bytes, type:', audioBlob.type);

                        // Convert to base64 data URL
                        const dataUrl = await this.blobToDataUrl(audioBlob);

                        // Stop all tracks
                        stream.getTracks().forEach(track => track.stop());

                        console.log('[Helios Audio] Recording complete, final size:', audioBlob.size, 'bytes');
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

                // Start recording WITHOUT timeslice (like asbplayer)
                // ondataavailable will fire when stop() is called
                this.mediaRecorder.start();
                console.log('[Helios Audio] Recording started, duration:', duration, 'ms');
                console.log('[Helios Audio] MediaRecorder state:', this.mediaRecorder.state);
                console.log('[Helios Audio] MediaRecorder mimeType:', this.mediaRecorder.mimeType);

                // Stop after duration
                setTimeout(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        console.log('[Helios Audio] Stopping recording after timeout');
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
