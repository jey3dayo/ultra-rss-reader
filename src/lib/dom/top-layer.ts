export const DIALOG_TOP_LAYER_SELECTOR = '[data-slot="dialog-content"][data-open]';
export const NESTED_ESCAPE_LAYER_SELECTOR = ['[role="dialog"]', "[data-radix-popper-content-wrapper]"].join(",");
export const FOCUS_OWNING_TOP_LAYER_SELECTOR = [
  '[data-stack-layer="dialog"]:not([data-closed])',
  '[data-stack-layer="commandPalette"]:not([data-closed])',
  '[role="dialog"][aria-modal="true"]',
].join(",");

type HiddenDialogSibling = {
  element: HTMLElement;
  ariaHidden: string | null;
  inertAttribute: string | null;
  inert: boolean;
};

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

function collectOutsideDialogElements(element: HTMLElement, dialogElements: HTMLElement[]): HTMLElement[] {
  const isDialogElement = dialogElements.some(
    (dialogElement) => element === dialogElement || element.contains(dialogElement) || dialogElement.contains(element),
  );

  if (!isDialogElement) {
    return [element];
  }

  const hasNestedDialogElement = dialogElements.some(
    (dialogElement) => element.contains(dialogElement) && element !== dialogElement,
  );
  if (!hasNestedDialogElement) {
    return [];
  }

  return Array.from(element.children).flatMap((child) =>
    child instanceof HTMLElement ? collectOutsideDialogElements(child, dialogElements) : [],
  );
}

export function hasOpenDialogTopLayer(root: ParentNode | null = getDefaultDocument()): boolean {
  if (!root) {
    return false;
  }

  return root.querySelector(DIALOG_TOP_LAYER_SELECTOR) !== null;
}

export function hasOpenNestedEscapeLayer(root: ParentNode | null = getDefaultDocument()): boolean {
  if (!root) {
    return false;
  }

  return root.querySelector(NESTED_ESCAPE_LAYER_SELECTOR) !== null;
}

export function topLayerOwnsFocus(ownerDocument: Document | null = getDefaultDocument()): boolean {
  if (!ownerDocument) {
    return false;
  }

  const activeElement = ownerDocument.activeElement;
  if (!isOwnerDocumentHtmlElement(activeElement, ownerDocument) || activeElement === ownerDocument.body) {
    return false;
  }

  const topLayer = activeElement.closest(FOCUS_OWNING_TOP_LAYER_SELECTOR);
  return topLayer !== null && !topLayer.hasAttribute("aria-hidden") && !topLayer.hasAttribute("inert");
}

export function hideElementsOutsideDialog(
  dialogId: string,
  ownerDocument: Document | null = getDefaultDocument(),
): () => void {
  if (!ownerDocument) {
    return () => undefined;
  }

  const dialogElements = Array.from(ownerDocument.querySelectorAll(`[data-dialog-stack-id="${dialogId}"]`)).filter(
    (element): element is HTMLElement => isOwnerDocumentHtmlElement(element, ownerDocument),
  );
  const hiddenElements: HiddenDialogSibling[] = [];
  const outsideElements = Array.from(ownerDocument.body.children).flatMap((child) =>
    isOwnerDocumentHtmlElement(child, ownerDocument) ? collectOutsideDialogElements(child, dialogElements) : [],
  );

  for (const element of outsideElements) {
    hiddenElements.push({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inertAttribute: element.getAttribute("inert"),
      inert: element.inert,
    });
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    element.inert = true;
  }

  return () => {
    for (const { element, ariaHidden, inertAttribute, inert } of hiddenElements) {
      if (ariaHidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", ariaHidden);
      }
      if (inertAttribute === null) {
        element.removeAttribute("inert");
      } else {
        element.setAttribute("inert", inertAttribute);
      }
      element.inert = inert;
    }
  };
}
