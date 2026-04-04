class TextScanner {
  constructor() {
    this._listeners = [];
  }

  register(callbacks = {}) {
    this.unregister();

    const capture = true;
    const add = (target, type, listener, options) => {
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

  unregister() {
    if (this._listeners) {
      this._listeners.forEach(({ target, type, listener, options }) => {
        target.removeEventListener(type, listener, options);
      });
    }
    this._listeners = [];
  }
}


