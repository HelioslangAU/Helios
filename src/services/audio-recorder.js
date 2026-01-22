/**
 * Audio Recorder Service for Helios Language Extension
 * Captures audio from YouTube videos with subtitle timing
 * Based on asbplayer's proven approach
 *
 * Key principles from asbplayer:
 * 1. Seek to subtitle.start - paddingBefore
 * 2. PLAY the video (critical - must play before capturing)
 * 3. Capture stream AFTER video is playing
 * 4. Record for (subtitle.end - subtitle.start) + paddingAfter duration
 * 5. MediaRecorder WITHOUT options (let browser choose format)
 * 6. Restore original video state when done
 */

class HeliosAudioRecorder {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
    }

    /**
     * Record audio from video element using asbplayer's approach
     * @param {HTMLVideoElement} videoElement - The video element to record from
     * @param {number} seekToTimeSec - Time in seconds to seek to (already includes padding)
     * @param {number} durationMs - Duration in milliseconds to record
     * @returns {Promise<string|null>} Data URL of recorded audio (WebM/Opus format)
     */
    async recordFromVideo(videoElement, seekToTimeSec, durationMs) {
        if (!videoElement) {
            console.error('[Helios Audio] No video element provided');
            return null;
        }

        if (this.isRecording) {
            console.warn('[Helios Audio] Already recording, please wait');
            return null;
        }

        // Validate captureStream support
        if (!this._checkCaptureStreamSupport(videoElement)) {
            console.error('[Helios Audio] captureStream() not supported');
            return null;
        }

        try {
            this.isRecording = true;

            // Step 1: Save original video state
            const originalTime = videoElement.currentTime;
            const wasPaused = videoElement.paused;
            const originalVolume = videoElement.volume;

            console.log('[Helios Audio] Starting recording:', {
                seekTo: seekToTimeSec + 's',
                duration: durationMs + 'ms',
                originalTime: originalTime + 's',
                wasPaused
            });

            // Step 2: Seek to start position (subtitle.start - paddingBefore)
            videoElement.currentTime = seekToTimeSec;
            await this._waitForSeek(videoElement);

            console.log('[Helios Audio] Seeked to:', videoElement.currentTime + 's');

            // Step 3: PLAY the video (CRITICAL - must play BEFORE capturing stream)
            await videoElement.play();
            console.log('[Helios Audio] Video is playing');

            // Small delay to ensure video is actually playing
            await this._delay(50);

            // Step 4: Capture stream AFTER video is playing
            const stream = videoElement.captureStream ?
                videoElement.captureStream() :
                videoElement.mozCaptureStream();

            if (!stream) {
                throw new Error('Failed to capture stream from video');
            }

            // Step 5: Extract audio tracks only (stop video tracks)
            const audioStream = new MediaStream();

            // Stop video tracks - we don't need them
            stream.getVideoTracks().forEach(track => track.stop());

            // Add audio tracks to our audio-only stream
            stream.getAudioTracks().forEach(track => {
                if (track.enabled) {
                    audioStream.addTrack(track);
                }
            });

            console.log('[Helios Audio] Stream captured - audio tracks:', audioStream.getAudioTracks().length);

            if (audioStream.getAudioTracks().length === 0) {
                throw new Error('No audio tracks available in stream');
            }

            // Step 6: Route audio to AudioContext (like asbplayer does)
            this.audioContext = new AudioContext();
            const source = this.audioContext.createMediaStreamSource(audioStream);
            source.connect(this.audioContext.destination);

            console.log('[Helios Audio] Audio routed to speakers');

            // Step 7: Record using MediaRecorder (NO options - browser chooses format)
            const audioDataUrl = await this._recordStream(audioStream, durationMs);

            // Step 8: Clean up AudioContext
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }

            // Step 9: Stop all tracks
            audioStream.getTracks().forEach(track => track.stop());

            // Step 10: Restore original video state
            console.log('[Helios Audio] Restoring original video state');
            videoElement.currentTime = originalTime;

            if (wasPaused) {
                videoElement.pause();
            }

            videoElement.volume = originalVolume;

            console.log('[Helios Audio] Recording complete');
            return audioDataUrl;

        } catch (error) {
            console.error('[Helios Audio] Recording failed:', error);
            return null;
        } finally {
            this.isRecording = false;
        }
    }

    /**
     * Check if video element supports captureStream
     * @private
     */
    _checkCaptureStreamSupport(videoElement) {
        return typeof videoElement.captureStream === 'function' ||
               typeof videoElement.mozCaptureStream === 'function';
    }

    /**
     * Wait for video seek to complete
     * @private
     */
    _waitForSeek(videoElement) {
        return new Promise((resolve) => {
            const onSeeked = () => {
                videoElement.removeEventListener('seeked', onSeeked);
                resolve();
            };
            videoElement.addEventListener('seeked', onSeeked);

            // Timeout fallback
            setTimeout(() => {
                videoElement.removeEventListener('seeked', onSeeked);
                resolve();
            }, 2000);
        });
    }

    /**
     * Simple delay utility
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Record from MediaStream for specified duration
     * Uses MediaRecorder WITHOUT options (browser auto-selects format)
     * @private
     */
    _recordStream(stream, durationMs) {
        return new Promise((resolve) => {
            try {
                this.audioChunks = [];

                // Create MediaRecorder WITHOUT options - let browser choose (like asbplayer)
                // This typically results in WebM/Opus format
                this.mediaRecorder = new MediaRecorder(stream);

                console.log('[Helios Audio] MediaRecorder created - mimeType:', this.mediaRecorder.mimeType);

                // Collect audio data chunks
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                // Handle recording completion
                this.mediaRecorder.onstop = async () => {
                    try {
                        console.log('[Helios Audio] Recording stopped, chunks:', this.audioChunks.length);

                        if (this.audioChunks.length === 0) {
                            console.error('[Helios Audio] No audio data captured');
                            resolve(null);
                            return;
                        }

                        // Create blob from chunks
                        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
                        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

                        console.log('[Helios Audio] Audio blob created:', {
                            size: audioBlob.size + ' bytes',
                            type: audioBlob.type
                        });

                        // Convert to data URL
                        const dataUrl = await this._blobToDataUrl(audioBlob);
                        resolve(dataUrl);

                    } catch (error) {
                        console.error('[Helios Audio] Error processing recording:', error);
                        resolve(null);
                    }
                };

                // Handle errors
                this.mediaRecorder.onerror = (event) => {
                    console.error('[Helios Audio] MediaRecorder error:', event.error);
                    resolve(null);
                };

                // Start recording
                this.mediaRecorder.start();
                console.log('[Helios Audio] Recording started for', durationMs, 'ms');

                // Stop recording after duration
                setTimeout(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                    }
                }, durationMs);

            } catch (error) {
                console.error('[Helios Audio] Error starting MediaRecorder:', error);
                resolve(null);
            }
        });
    }

    /**
     * Convert Blob to data URL
     * @private
     */
    _blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Stop any ongoing recording
     */
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isRecording = false;
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.HeliosAudioRecorder = new HeliosAudioRecorder();
    console.log('[Helios Audio] Audio recorder initialized');
}
