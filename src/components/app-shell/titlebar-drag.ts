const INTERACTIVE_TITLEBAR_TARGET_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "[data-titlebar-interactive]",
].join(",");

function eventTargetElement(event: Event): Element | null {
  const [firstTarget] = event.composedPath();
  if (firstTarget instanceof Element) {
    return firstTarget;
  }

  return event.target instanceof Element ? event.target : null;
}

function isInteractiveTitlebarTarget(target: Element): boolean {
  return target.closest(INTERACTIVE_TITLEBAR_TARGET_SELECTOR) !== null;
}

export function shouldStartDesktopTitlebarDrag(event: PointerEvent): boolean {
  if (event.button !== 0) {
    return false;
  }

  const target = eventTargetElement(event);
  if (target === null || isInteractiveTitlebarTarget(target)) {
    return false;
  }

  return target.closest("[data-tauri-drag-region]") !== null;
}
