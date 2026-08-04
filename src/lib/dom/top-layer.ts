const DIALOG_TOP_LAYER_SELECTOR = '[data-slot="dialog-content"][data-open]';
const DIALOG_INERT_EXCLUSION_SELECTOR = "[data-agentation-root]";
const NESTED_ESCAPE_LAYER_SELECTOR = ['[role="dialog"]', "[data-radix-popper-content-wrapper]"].join(",");
const FOCUS_OWNING_TOP_LAYER_SELECTOR = [
  '[data-stack-layer="dialog"]:not([data-closed])',
  '[data-stack-layer="commandPalette"]:not([data-closed])',
  '[role="dialog"][aria-modal="true"]',
].join(",");

type HiddenDialogState = {
  count: number;
  ariaHidden: string | null;
  inertAttribute: string | null;
  inert: boolean;
};

// Stacked dialogs (e.g. feed edit -> unsubscribe confirm) can hide the same
// element twice. Snapshot-restore alone breaks when cleanups run in mount
// order: the later dialog would restore the inert state the earlier dialog had
// applied. Reference-count per element so only the last release restores the
// original attributes.
const hiddenDialogStates = new WeakMap<HTMLElement, HiddenDialogState>();

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
  if (element.matches(DIALOG_INERT_EXCLUSION_SELECTOR) || element.closest(DIALOG_INERT_EXCLUSION_SELECTOR)) {
    return [];
  }

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

  const dialogElements = Array.from(
    ownerDocument.querySelectorAll(
      [
        `[data-dialog-stack-id="${dialogId}"]`,
        '[data-slot="dialog-overlay"][data-dialog-stack-id][data-open]',
        '[data-slot="dialog-content"][data-dialog-stack-id][data-open]',
      ].join(","),
    ),
  ).filter((element): element is HTMLElement => isOwnerDocumentHtmlElement(element, ownerDocument));
  const hiddenElements: HTMLElement[] = [];
  const outsideElements = Array.from(ownerDocument.body.children).flatMap((child) =>
    isOwnerDocumentHtmlElement(child, ownerDocument) ? collectOutsideDialogElements(child, dialogElements) : [],
  );

  for (const element of outsideElements) {
    const state = hiddenDialogStates.get(element);
    if (state) {
      state.count += 1;
    } else {
      hiddenDialogStates.set(element, {
        count: 1,
        ariaHidden: element.getAttribute("aria-hidden"),
        inertAttribute: element.getAttribute("inert"),
        inert: element.inert,
      });
    }
    hiddenElements.push(element);
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    element.inert = true;
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    for (const element of hiddenElements) {
      const state = hiddenDialogStates.get(element);
      if (!state) {
        continue;
      }
      if (state.count > 1) {
        state.count -= 1;
        continue;
      }
      hiddenDialogStates.delete(element);
      if (state.ariaHidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", state.ariaHidden);
      }
      if (state.inertAttribute === null) {
        element.removeAttribute("inert");
      } else {
        element.setAttribute("inert", state.inertAttribute);
      }
      element.inert = state.inert;
    }
  };
}
