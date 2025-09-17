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

  handleKeyDown(event, { onActivate } = {}) {
    if (event.key === this.activationKey && !this.isActivationKeyPressed) {
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
    if (this.isActive()) {
      event.preventDefault();
      return false;
    }
  }
}


