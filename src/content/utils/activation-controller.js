class ActivationController {
  constructor(defaultKey = "Shift") {
    this.activationKey = defaultKey;
    this.isActivationKeyPressed = false;
  }

  setKey(key) {
    this.activationKey = key || "Shift";
    this.isActivationKeyPressed = false;
  }

  isActive() {
    return this.isActivationKeyPressed === true;
  }

  _isEditable(target) {
    if (!target) return false;
    const tag = (target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (target.isContentEditable) return true;
    return false;
  }

  handleKeyDown(event, { onActivate } = {}) {
    // Do not activate while typing in editable elements
    if (this._isEditable(event.target)) return;
    // Only activate when the exact activation key is pressed with no other modifiers
    if (
      event.key === this.activationKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !this.isActivationKeyPressed
    ) {
      this.isActivationKeyPressed = true;
      if (onActivate) onActivate();
    }
  }

  handleKeyUp(event, { onDeactivate } = {}) {
    if (event.key === this.activationKey) {
      this.isActivationKeyPressed = false;
      if (onDeactivate) onDeactivate();
    }
  }

  toggleActivationMode(active) {
    document.body.style.cursor = active ? "help" : "";
    document.body.toggleAttribute("data-activation-active", active);
    if (active) window.getSelection()?.removeAllRanges();
  }

  blockDuringActivation(event) {
    // Allow normal behavior in editable elements
    if (this._isEditable(event.target)) return;
    if (this.isActive()) {
      event.preventDefault();
      return false;
    }
  }
}