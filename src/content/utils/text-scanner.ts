export interface TextScannerCallbacks {
  onPointerMove?: (event: PointerEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onSelectStart?: (event: Event) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onClick?: (event: MouseEvent) => void;
}

interface RegisteredListener {
  target: EventTarget;
  type: string;
  listener: EventListener;
  options?: boolean | AddEventListenerOptions;
}

export class TextScanner {
  _listeners: RegisteredListener[];

  constructor() {
    this._listeners = [];
  }

  register(callbacks: TextScannerCallbacks = {}): void {
    this.unregister();

    const capture = true;
    const add = (
      target: EventTarget,
      type: string,
      listener: ((event: any) => void) | undefined,
      options?: boolean | AddEventListenerOptions
    ) => {
      if (!listener) return;
      target.addEventListener(type, listener, options);
      this._listeners.push({ target, type, listener, options });
    };

    add(document, "pointermove", callbacks.onPointerMove, capture);
    add(document, "keydown", callbacks.onKeyDown, capture);
    add(document, "keyup", callbacks.onKeyUp, capture);
    add(document, "selectstart", callbacks.onSelectStart, capture);
    add(document, "contextmenu", callbacks.onContextMenu, capture);
    add(document, "click", callbacks.onClick, capture);
  }

  unregister(): void {
    if (this._listeners) {
      this._listeners.forEach(({ target, type, listener, options }) => {
        target.removeEventListener(type, listener, options);
      });
    }
    this._listeners = [];
  }
}
