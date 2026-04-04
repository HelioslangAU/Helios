/**
 * Handles loading subtitle files via drag & drop or file picker
 */
class SubtitleFileLoader {
  constructor(videoDetector) {
    this.videoDetector = videoDetector;
    this.dropZone = null;
    this.fileInput = null;
    this.isActive = false;
  }

  /**
   * Initialize the loader
   */
  async init() {
    this._createDropZone();
    this._createFileInput();
    this._setupDragAndDrop();
    await this._setupKeyboardShortcut();
  }

  /**
   * Create drop zone overlay
   */
  _createDropZone() {
    this.dropZone = document.createElement('div');
    this.dropZone.className = 'helios-drop-zone';
    this.dropZone.style.display = 'none';
    this.dropZone.innerHTML = `
      <div class="helios-drop-zone-content">
        <div class="helios-drop-zone-icon">📁</div>
        <div class="helios-drop-zone-text">Drop subtitle file here</div>
        <div class="helios-drop-zone-hint">Supports SRT, VTT formats</div>
      </div>
    `;

    document.body.appendChild(this.dropZone);
  }

  /**
   * Create hidden file input
   */
  _createFileInput() {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.srt,.vtt';
    this.fileInput.style.display = 'none';

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this._handleFile(file);
      }
      this.fileInput.value = ''; // Reset for re-selection
    });

    document.body.appendChild(this.fileInput);
  }

  /**
   * Setup drag and drop event listeners
   */
  _setupDragAndDrop() {
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;

      if (this._isDraggingFile(e) && dragCounter === 1) {
        this._showDropZone();
      }
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;

      if (dragCounter === 0) {
        this._hideDropZone();
      }
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      this._hideDropZone();

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this._handleFile(files[0]);
      }
    });
  }

  /**
   * Setup keyboard shortcut for opening file picker
   */
  async _setupKeyboardShortcut() {
    // Load shortcut configuration
    const shortcuts = await ShortcutHelper.getVideoShortcuts();
    const loadShortcut = shortcuts.loadSubtitles;

    // Remove existing listener if any
    if (this._keyboardListener) {
      document.removeEventListener('keydown', this._keyboardListener);
    }

    // Create new listener with current shortcut config
    this._keyboardListener = (e) => {
      // Don't trigger if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if (ShortcutHelper.matchesVideoShortcut(e, loadShortcut)) {
        e.preventDefault();
        this.openFilePicker();
      }
    };

    document.addEventListener('keydown', this._keyboardListener);
  }

  /**
   * Check if dragging operation contains files
   * @param {DragEvent} e
   * @returns {boolean}
   */
  _isDraggingFile(e) {
    if (!e.dataTransfer) return false;

    const types = e.dataTransfer.types;
    return types && (types.includes('Files') || types.includes('application/x-moz-file'));
  }

  /**
   * Show drop zone overlay
   */
  _showDropZone() {
    this.dropZone.style.display = 'flex';
  }

  /**
   * Hide drop zone overlay
   */
  _hideDropZone() {
    this.dropZone.style.display = 'none';
  }

  /**
   * Open file picker dialog
   */
  openFilePicker() {
    this.fileInput.click();
  }

  /**
   * Handle subtitle file
   * @param {File} file
   */
  async _handleFile(file) {
    const filename = file.name.toLowerCase();

    // Validate file type
    if (!filename.endsWith('.srt') && !filename.endsWith('.vtt')) {
      this._showNotification('Invalid file type. Please use SRT or VTT files.', 'error');
      return;
    }

    // Get the primary video binding
    const binding = this.videoDetector.getPrimaryBinding();

    if (!binding) {
      this._showNotification('No video element found on page.', 'error');
      return;
    }

    // Load the subtitle file
    const success = await binding.loadSubtitleFile(file);

    if (success) {
      this._showNotification(`Loaded ${binding.getSubtitles().getCount()} subtitles from ${file.name}`, 'success');
    } else {
      this._showNotification('Failed to load subtitle file.', 'error');
    }
  }

  /**
   * Show notification to user
   * @param {string} message
   * @param {string} type - 'info', 'success', 'error'
   */
  _showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `helios-notification helios-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.parentElement.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Destroy loader and cleanup
   */
  destroy() {
    if (this.dropZone && this.dropZone.parentElement) {
      this.dropZone.parentElement.removeChild(this.dropZone);
    }
    if (this.fileInput && this.fileInput.parentElement) {
      this.fileInput.parentElement.removeChild(this.fileInput);
    }
  }
}
