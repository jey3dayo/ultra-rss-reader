export type WindowEventBinding = {
  target?: Pick<Window, "addEventListener" | "removeEventListener">;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

type RegisteredWindowEventBinding = Omit<WindowEventBinding, "target"> & {
  target: Pick<Window, "addEventListener" | "removeEventListener">;
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
    let acceptedDetail: T;
    try {
      if (!isDetail(detail)) {
        return;
      }
      acceptedDetail = detail;
    } catch {
      return;
    }

    handleEvent(acceptedDetail);
  };
}

export function isWindowNavigationDirection(detail: unknown): detail is 1 | -1 {
  return detail === 1 || detail === -1;
}

export function bindWindowEvents(bindings: readonly WindowEventBinding[]) {
  const registeredBindings: RegisteredWindowEventBinding[] = [];

  const cleanupRegisteredBindings = (options: { reverse?: boolean } = {}) => {
    const bindingsToCleanup = options.reverse ? registeredBindings.slice().reverse() : registeredBindings;

    for (const { target, type, listener, options } of bindingsToCleanup) {
      try {
        target.removeEventListener(type, listener, options);
      } catch (error) {
        console.error("Failed to remove window event listener.", error);
      }
    }
  };

  try {
    for (const { target = window, type, listener, options } of bindings) {
      target.addEventListener(type, listener, options);
      registeredBindings.push({ target, type, listener, options });
    }
  } catch (error) {
    try {
      cleanupRegisteredBindings({ reverse: true });
    } catch {
      // Preserve the original registration failure; cleanup best-effort already ran.
    }
    throw error;
  }

  return cleanupRegisteredBindings;
}
