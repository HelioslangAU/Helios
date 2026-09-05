export class ActivationController {
  activationKey: string;
  isActivationKeyPressed: boolean;

  constructor(defaultKey: string = "Shift") {
    this.activationKey = defaultKey;
    this.isActivationKeyPressed = false;
  }

  setKey(key: string | null | undefined): void {
    this.activationKey = key || "Shift";
    this.isActivationKeyPressed = false;
  }

  isActive(): boolean {
    return this.isActivationKeyPressed === true;
  }

  _isEditable(target: EventTarget | null): boolean {
    if (!target) return false;
    const element = target as HTMLElement;
    const tag = (element.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (element.isContentEditable) return true;
    return false;
  }

  handleKeyDown(event: KeyboardEvent, { onActivate }: { onActivate?: () => void } = {}): void {
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

  handleKeyUp(event: KeyboardEvent, { onDeactivate }: { onDeactivate?: () => void } = {}): void {
    if (event.key === this.activationKey) {
      this.isActivationKeyPressed = false;
      if (onDeactivate) onDeactivate();
    }
  }

  toggleActivationMode(active: boolean): void {
    document.body.style.cursor = active ? "help" : "";
    document.body.toggleAttribute("data-activation-active", active);
    if (active) window.getSelection()?.removeAllRanges();
  }

  blockDuringActivation(event: Event): boolean | undefined {
    // Allow normal behavior in editable elements
    if (this._isEditable(event.target)) return;
    if (this.isActive()) {
      event.preventDefault();
      return false;
    }
  }
}
