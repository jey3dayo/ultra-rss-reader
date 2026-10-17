import { getDefaultDocument, isOwnerDocumentHtmlElement } from "./document";

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
