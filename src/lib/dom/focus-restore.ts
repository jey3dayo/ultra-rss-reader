function getDefaultDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

function isOwnerDocumentHtmlElement(element: Element | null, ownerDocument: Document): element is HTMLElement {
  const ownerWindow = ownerDocument.defaultView;
  if (ownerWindow) {
    return element instanceof ownerWindow.HTMLElement;
  }

  return typeof HTMLElement !== "undefined" && element instanceof HTMLElement;
}

export function getRestorableActiveElement(ownerDocument: Document | null = getDefaultDocument()): HTMLElement | null {
  if (!ownerDocument || !isOwnerDocumentHtmlElement(ownerDocument.activeElement, ownerDocument)) {
    return null;
  }

  return ownerDocument.activeElement;
}

export function restoreFocusOnMicrotask(
  restoreFocusElement: HTMLElement | null,
  ownerDocument: Document | null = getDefaultDocument(),
): void {
  queueMicrotask(() => {
    if (restoreFocusElement && ownerDocument?.contains(restoreFocusElement)) {
      restoreFocusElement.focus();
    }
  });
}
