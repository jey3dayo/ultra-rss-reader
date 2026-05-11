export function isOutsideElement(element: Element | null, target: Event | EventTarget | null): boolean {
  if (element === null || target === null) {
    return false;
  }

  if (target instanceof Event) {
    const path = target.composedPath();

    if (path.includes(element)) {
      return false;
    }

    return path.length > 0 || isOutsideElement(element, target.target);
  }

  if (!(target instanceof Node)) {
    return false;
  }

  if (element.contains(target)) {
    return false;
  }

  const root = target.getRootNode();

  if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot && element.contains(root.host)) {
    return false;
  }

  return true;
}
