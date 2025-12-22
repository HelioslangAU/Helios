/**
 * Media Storage Service
 * Handles storing media files (screenshots, audio) via AnkiConnect API
 */

class MediaStorage {
    /**
     * Store media file in Anki's media collection
     * @param {string} dataUrl - Base64 data URL of the media file
     * @param {string} type - Type of media: 'screenshot' or 'audio'
     * @param {Object} invokeAnkiFunc - Reference to AnkiConnect invoke function
     * @returns {Promise<string|null>} Anki field value (HTML for image, [sound:] for audio) or null on error
     */
    static async storeMediaFile(dataUrl, type, invokeAnkiFunc) {
        if (!dataUrl) {
            console.warn('[Helios Media] No data URL provided for media storage');
            return null;
        }

        try {
            // Extract base64 data from data URL
            const base64Data = this.extractBase64(dataUrl);
            if (!base64Data) {
                console.error('[Helios Media] Failed to extract base64 data from data URL');
                return null;
            }

            // Generate filename
            const fileName = this.generateFileName(type);

            // Store via AnkiConnect
            console.log('[Helios Media] Storing media file:', fileName);
            const result = await invokeAnkiFunc('storeMediaFile', {
                filename: fileName,
                data: base64Data
            });

            if (result === null) {
                console.error('[Helios Media] AnkiConnect returned null when storing media');
                return null;
            }

            // Format as Anki field value
            const fieldValue = this.formatAsAnkiField(fileName, type);
            console.log('[Helios Media] Media stored successfully:', fileName);

            return fieldValue;

        } catch (error) {
            console.error('[Helios Media] Error storing media file:', error);
            return null;
        }
    }

    /**
     * Extract base64 data from data URL
     * @param {string} dataUrl - Data URL (data:image/jpeg;base64,...)
     * @returns {string|null} Base64 encoded data
     */
    static extractBase64(dataUrl) {
        if (!dataUrl || !dataUrl.includes(',')) {
            return null;
        }

        // Split on comma to get base64 part
        const parts = dataUrl.split(',');
        if (parts.length !== 2) {
            return null;
        }

        return parts[1];
    }

    /**
     * Generate unique filename for media
     * @param {string} type - 'screenshot' or 'audio'
     * @returns {string}
     */
    static generateFileName(type) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);

        let extension = '';
        if (type === 'screenshot') {
            extension = 'jpg';
        } else if (type === 'audio') {
            extension = 'webm'; // MediaRecorder typically produces WebM
        }

        return `helios_${type}_${timestamp}_${random}.${extension}`;
    }

    /**
     * Format filename as Anki field value
     * @param {string} fileName
     * @param {string} type - 'screenshot' or 'audio'
     * @returns {string}
     */
    static formatAsAnkiField(fileName, type) {
        if (type === 'screenshot') {
            // Image HTML tag
            return `<img src="${fileName}">`;
        } else if (type === 'audio') {
            // Anki audio format
            return `[sound:${fileName}]`;
        }

        return fileName;
    }

    /**
     * Delete media file from Anki
     * @param {string} fileName
     * @param {Object} invokeAnkiFunc - Reference to AnkiConnect invoke function
     * @returns {Promise<boolean>}
     */
    static async deleteMediaFile(fileName, invokeAnkiFunc) {
        try {
            await invokeAnkiFunc('deleteMediaFile', {
                filename: fileName
            });
            console.log('[Helios Media] Deleted media file:', fileName);
            return true;
        } catch (error) {
            console.error('[Helios Media] Error deleting media file:', error);
            return false;
        }
    }

    /**
     * Check if media file exists in Anki
     * @param {string} fileName
     * @param {Object} invokeAnkiFunc - Reference to AnkiConnect invoke function
     * @returns {Promise<boolean>}
     */
    static async mediaFileExists(fileName, invokeAnkiFunc) {
        try {
            const result = await invokeAnkiFunc('retrieveMediaFile', {
                filename: fileName
            });
            return result !== false && result !== null;
        } catch (error) {
            console.error('[Helios Media] Error checking media file:', error);
            return false;
        }
    }

    /**
     * Validate data URL before storage
     * @param {string} dataUrl
     * @param {string} type - 'screenshot' or 'audio'
     * @returns {Object} {valid: boolean, error: string|null, size: number}
     */
    static validateDataUrl(dataUrl, type) {
        const result = {
            valid: true,
            error: null,
            size: 0
        };

        if (!dataUrl) {
            result.valid = false;
            result.error = 'Data URL is empty';
            return result;
        }

        // Check data URL format
        if (!dataUrl.startsWith('data:')) {
            result.valid = false;
            result.error = 'Invalid data URL format';
            return result;
        }

        // Calculate approximate size (base64 is ~33% larger than actual data)
        const base64 = this.extractBase64(dataUrl);
        if (!base64) {
            result.valid = false;
            result.error = 'Cannot extract base64 data';
            return result;
        }

        result.size = Math.floor((base64.length * 3) / 4);

        // Anki has a 100MB limit per media file
        const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
        if (result.size > MAX_SIZE) {
            result.valid = false;
            result.error = `File size (${this.formatBytes(result.size)}) exceeds Anki's 100MB limit`;
            return result;
        }

        // Warning for large files
        const WARN_SIZE = 10 * 1024 * 1024; // 10 MB
        if (result.size > WARN_SIZE) {
            console.warn(`[Helios Media] Large file size: ${this.formatBytes(result.size)}`);
        }

        return result;
    }

    /**
     * Format bytes as human-readable string
     * @param {number} bytes
     * @returns {string}
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaStorage;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.HeliosMediaStorage = MediaStorage;
}
