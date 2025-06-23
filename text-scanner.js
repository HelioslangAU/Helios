// Yomitan-style TextScanner for robust text selection and scanning

class TextScanner {
    constructor(node) {
        this._node = node || document;
        this._lastMouseMove = null;
        this._enabled = false;
        this._eventListeners = [];
    }

    setEnabled(enabled) {
        this._enabled = enabled;
        this._removeAllEventListeners();
        if (enabled) {
            this._addEventListeners();
        }
    }

    _addEventListeners() {
        const capture = true;
        this._eventListeners.push(
            this._addEvent(this._node, 'pointermove', this._onPointerMove.bind(this), capture),
            this._addEvent(this._node, 'pointerdown', this._onPointerDown.bind(this), capture),
            this._addEvent(this._node, 'pointerup', this._onPointerUp.bind(this), capture),
            this._addEvent(this._node, 'keydown', this._onKeyDown.bind(this), capture),
            this._addEvent(this._node, 'keyup', this._onKeyUp.bind(this), capture),
            this._addEvent(this._node, 'selectstart', this._onSelectStart.bind(this), capture),
            this._addEvent(this._node, 'contextmenu', this._onContextMenu.bind(this), capture),
            this._addEvent(this._node, 'click', this._onClick.bind(this), capture)
        );
    }

    _removeAllEventListeners() {
        for (const {target, type, listener, options} of this._eventListeners) {
            target.removeEventListener(type, listener, options);
        }
        this._eventListeners = [];
    }

    _addEvent(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        return {target, type, listener, options};
    }

    _onPointerMove(event) {
        this._lastMouseMove = event;
        // Implement your scan/lookup logic here
        // e.g., this.scanAt(event.clientX, event.clientY);
    }

    _onPointerDown(event) {
        // Prevent unwanted selection if needed
    }

    _onPointerUp(event) {
        // Optional: handle pointer up
    }

    _onKeyDown(event) {
        // Handle modifier keys for instant lookup
        // e.g., if (event.key === 'Shift') { ... }
    }

    _onKeyUp(event) {
        // Handle modifier key release
    }

    _onSelectStart(event) {
        // Prevent selection if needed
    }

    _onContextMenu(event) {
        // Prevent context menu if needed
    }

    _onClick(event) {
        // Hide popup or clear highlight if needed
    }

    // Add more methods as needed for your extension
}

// Make available globally for use in content.js
window.TextScanner = TextScanner;