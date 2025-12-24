/**
 * Audio Recorder Service
 * Handles audio recording from video content for Anki cards
 * Based on asbplayer's approach
 */

class AudioRecorder {
    constructor() {
        this.recording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
    }

    /**
     * Record audio from video element (asbplayer approach)
     * @param {HTMLVideoElement} videoElement - The video element to record from
     * @param {number} seekToTime - Time to seek to in seconds (already includes padding before)
     * @param {number} duration - Duration in milliseconds to record
     * @returns {Promise<string|null>} Base64 data URL of recorded audio
     */
    async recordFromVideo(videoElement, seekToTime, duration) {
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
                return null;
            }

            // Save original state
            const originalTime = videoElement.currentTime;
            const wasPaused = videoElement.paused;
            console.log('[Helios Audio] Original state - time:', originalTime, 's, paused:', wasPaused);

            // Step 1: Seek to start position (like asbplayer: subtitle.start - paddingBefore)
            console.log('[Helios Audio] Seeking to:', seekToTime, 's');
            videoElement.currentTime = seekToTime;

            // Wait for seek to complete
            await new Promise(resolve => {
                const onSeeked = () => {
                    videoElement.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                videoElement.addEventListener('seeked', onSeeked);
            });

            console.log('[Helios Audio] Seek complete, current time:', videoElement.currentTime, 's');

            // Step 2: Play the video (CRITICAL - must play before capturing stream)
            await videoElement.play();
            console.log('[Helios Audio] Video playing');

            // Step 3: Capture stream from video element (AFTER playing)
            const stream = this.captureVideoStream(videoElement);
            if (!stream) {
                // Restore state before returning
                if (wasPaused) {
                    videoElement.pause();
                }
                videoElement.currentTime = originalTime;
                return null;
            }

            // Step 4: Start recording
            console.log('[Helios Audio] Starting recording for', duration, 'ms');
            const audioDataUrl = await this.recordStream(stream, duration);

            // Step 5: Restore original state
            console.log('[Helios Audio] Recording complete, restoring state');
            videoElement.currentTime = originalTime;

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
            console.log('[Helios Audio] Capturing stream - video state:', {
                paused: videoElement.paused,
                muted: videoElement.muted,
                currentTime: videoElement.currentTime
            });

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
                console.error('[Helios Audio] Failed to capture stream - API not available');
                return null;
            }

            console.log('[Helios Audio] Stream captured - video tracks:', stream.getVideoTracks().length, 'audio tracks:', stream.getAudioTracks().length);

            // Check if we have audio tracks
            if (stream.getAudioTracks().length === 0) {
                console.error('[Helios Audio] No audio tracks available in stream');
                return null;
            }

            // Create new MediaStream with only audio tracks (like asbplayer)
            const audioStream = new MediaStream();

            // Stop video tracks (we don't need them)
            for (const track of stream.getVideoTracks()) {
                track.stop();
            }

            // Add enabled audio tracks
            for (const track of stream.getAudioTracks()) {
                if (track.enabled) {
                    audioStream.addTrack(track);
                }
            }

            // Log audio track details
            const audioTrack = audioStream.getAudioTracks()[0];
            console.log('[Helios Audio] Audio track:', {
                id: audioTrack.id,
                enabled: audioTrack.enabled,
                readyState: audioTrack.readyState
            });

            // Route audio to speakers using AudioContext (like asbplayer)
            try {
                const output = new AudioContext();
                const source = output.createMediaStreamSource(audioStream);
                source.connect(output.destination);
                console.log('[Helios Audio] Audio routed to speakers');
            } catch (error) {
                console.warn('[Helios Audio] Could not route to speakers:', error);
            }

            return audioStream;

        } catch (error) {
            console.error('[Helios Audio] Error capturing stream:', error);
            return null;
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

                // Create MediaRecorder WITHOUT options - let browser choose (like asbplayer)
                this.mediaRecorder = new MediaRecorder(stream);

                // Collect data chunks
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        this.audioChunks.push(event.data);
                        console.log('[Helios Audio] Chunk received:', event.data.size, 'bytes, total chunks:', this.audioChunks.length);
                    }
                };

                // Handle recording stop
                this.mediaRecorder.onstop = async () => {
                    this.recording = false;

                    try {
                        console.log('[Helios Audio] Recording stopped, chunks:', this.audioChunks.length);

                        if (this.audioChunks.length === 0) {
                            console.error('[Helios Audio] No audio data captured');
                            resolve(null);
                            return;
                        }

                        // Create blob from chunks
                        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
                        console.log('[Helios Audio] Blob created:', audioBlob.size, 'bytes, type:', audioBlob.type);

                        // Convert to base64 data URL
                        const dataUrl = await this.blobToDataUrl(audioBlob);

                        // Stop all tracks
                        stream.getTracks().forEach(track => track.stop());

                        console.log('[Helios Audio] Recording complete, size:', audioBlob.size, 'bytes');
                        resolve(dataUrl);

                    } catch (error) {
                        console.error('[Helios Audio] Error processing audio:', error);
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
                this.mediaRecorder.start();
                console.log('[Helios Audio] Recording started - duration:', duration, 'ms, mimeType:', this.mediaRecorder.mimeType);

                // Stop after duration
                setTimeout(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        console.log('[Helios Audio] Stopping recording after', duration, 'ms');
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
     * Stop any ongoing recording
     */
    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        this.recording = false;
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.HeliosAudioRecorder = new AudioRecorder();
}
