export type WindowEventBinding = {
  target?: Pick<Window, "addEventListener" | "removeEventListener">;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

export function createKeyboardEventListener(handleEvent: (event: KeyboardEvent) => void): EventListener {
  return (event) => {
    if (event instanceof KeyboardEvent) {
      handleEvent(event);
    }
  };
}

export function createMouseEventListener(handleEvent: (event: MouseEvent) => void): EventListener {
  return (event) => {
    const isPointerEvent = typeof PointerEvent !== "undefined" && event instanceof PointerEvent;
    if (event instanceof MouseEvent && !isPointerEvent) {
      handleEvent(event);
    }
  };
}

export function createPointerEventListener(handleEvent: (event: PointerEvent) => void): EventListener {
  return (event) => {
    if (event instanceof PointerEvent) {
      handleEvent(event);
    }
  };
}

export function createCustomEventDetailListener<T>(
  isDetail: (detail: unknown) => detail is T,
  handleEvent: (detail: T) => void,
): EventListener {
  return (event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const detail: unknown = event.detail;
    if (isDetail(detail)) {
      handleEvent(detail);
    }
  };
}

export function bindWindowEvents(bindings: readonly WindowEventBinding[]) {
  for (const { target = window, type, listener, options } of bindings) {
    target.addEventListener(type, listener, options);
  }

  return () => {
    for (const { target = window, type, listener, options } of bindings) {
      target.removeEventListener(type, listener, options);
    }
  };
}
