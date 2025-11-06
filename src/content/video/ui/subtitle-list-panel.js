/**
 * Manages the side panel displaying full subtitle list
 */
class SubtitleListPanel {
  constructor() {
    this.panel = null;
    this.subtitleCollection = null;
    this.currentTime = 0;
    this.isVisible = false;
    this.onSubtitleClick = null; // Callback for subtitle click (seek video)

    this._init();
  }

  /**
   * Initialize panel UI
   */
  _init() {
    this.panel = document.createElement('div');
    this.panel.className = 'helios-subtitle-panel';
    this.panel.setAttribute('data-helios-panel', 'true');
    this.panel.style.display = 'none';

    // Create header
    const header = document.createElement('div');
    header.className = 'helios-panel-header';
    header.innerHTML = `
      <span class="helios-panel-title">Subtitles</span>
      <button class="helios-panel-close" title="Close">&times;</button>
    `;

    // Create subtitle list container
    const listContainer = document.createElement('div');
    listContainer.className = 'helios-panel-list';

    this.panel.appendChild(header);
    this.panel.appendChild(listContainer);

    // Add to DOM
    document.body.appendChild(this.panel);

    // Setup event listeners
    this._setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Close button
    const closeBtn = this.panel.querySelector('.helios-panel-close');
    closeBtn.addEventListener('click', () => this.hide());

    // Make panel draggable
    const header = this.panel.querySelector('.helios-panel-header');
    this._makeDraggable(header);
  }

  /**
   * Make panel draggable
   * @param {HTMLElement} handle - Drag handle element
   */
  _makeDraggable(handle) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      initialX = e.clientX - this.panel.offsetLeft;
      initialY = e.clientY - this.panel.offsetTop;
      handle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      this.panel.style.left = currentX + 'px';
      this.panel.style.top = currentY + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = 'grab';
      }
    });
  }

  /**
   * Load subtitles into panel
   * @param {SubtitleCollection} collection - Subtitle collection
   */
  loadSubtitles(collection) {
    this.subtitleCollection = collection;
    this._renderList();
  }

  /**
   * Render subtitle list
   */
  _renderList() {
    const listContainer = this.panel.querySelector('.helios-panel-list');
    listContainer.innerHTML = '';

    if (!this.subtitleCollection || this.subtitleCollection.isEmpty()) {
      listContainer.innerHTML = '<div class="helios-panel-empty">No subtitles loaded</div>';
      return;
    }

    const subtitles = this.subtitleCollection.getAll();
    subtitles.forEach((subtitle) => {
      const item = document.createElement('div');
      item.className = 'helios-panel-item';
      item.setAttribute('data-subtitle-index', subtitle.index);
      item.setAttribute('data-start-time', subtitle.start);

      const timestamp = document.createElement('span');
      timestamp.className = 'helios-panel-timestamp';
      timestamp.textContent = this._formatTime(subtitle.start);

      const text = document.createElement('span');
      text.className = 'helios-panel-text';
      text.textContent = subtitle.text;

      item.appendChild(timestamp);
      item.appendChild(text);

      // Click to seek
      item.addEventListener('click', () => {
        if (this.onSubtitleClick) {
          this.onSubtitleClick(subtitle);
        }
      });

      listContainer.appendChild(item);
    });
  }

  /**
   * Update current time and highlight active subtitle
   * @param {number} timeMs - Current time in milliseconds
   */
  updateCurrentTime(timeMs) {
    this.currentTime = timeMs;
    this._highlightCurrentSubtitle();
  }

  /**
   * Highlight currently active subtitle
   */
  _highlightCurrentSubtitle() {
    const items = this.panel.querySelectorAll('.helios-panel-item');

    items.forEach((item) => {
      const startTime = parseInt(item.getAttribute('data-start-time'));
      const index = parseInt(item.getAttribute('data-subtitle-index'));
      const subtitle = this.subtitleCollection.getByIndex(index);

      if (subtitle && subtitle.isActiveAt(this.currentTime)) {
        item.classList.add('helios-panel-item-active');

        // Auto-scroll to active subtitle
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        item.classList.remove('helios-panel-item-active');
      }
    });
  }

  /**
   * Format time in milliseconds to HH:MM:SS
   * @param {number} ms - Time in milliseconds
   * @returns {string}
   */
  _formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Show panel
   */
  show() {
    this.panel.style.display = 'block';
    this.isVisible = true;
  }

  /**
   * Hide panel
   */
  hide() {
    this.panel.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Destroy panel and cleanup
   */
  destroy() {
    if (this.panel && this.panel.parentElement) {
      this.panel.parentElement.removeChild(this.panel);
    }
    this.panel = null;
  }
}
