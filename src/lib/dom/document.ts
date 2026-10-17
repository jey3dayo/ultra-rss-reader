export function getDefaultDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

export function isOwnerDocumentHtmlElement(element: Element | null, ownerDocument: Document): element is HTMLElement {
  const ownerWindow = ownerDocument.defaultView;
  if (ownerWindow) {
    return element instanceof ownerWindow.HTMLElement;
  }

  return typeof HTMLElement !== "undefined" && element instanceof HTMLElement;
}
