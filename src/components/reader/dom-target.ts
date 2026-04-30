export function isOutsideElement(element: Element | null, target: EventTarget | null): boolean {
  return element !== null && target instanceof Node && !element.contains(target);
}
