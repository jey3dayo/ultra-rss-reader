const HIDDEN_PANE_FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[tabindex]",
].join(",");

export const HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE = "data-hidden-pane-previous-tabindex";

export function disableHiddenPaneFocus(root: HTMLElement, ownerDocument: Document = document): void {
  const focusableElements = root.querySelectorAll<HTMLElement>(HIDDEN_PANE_FOCUSABLE_SELECTOR);

  for (const element of focusableElements) {
    if (!element.hasAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE)) {
      element.setAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE, element.getAttribute("tabindex") ?? "");
    }
    if (element.getAttribute("tabindex") !== "-1") {
      element.setAttribute("tabindex", "-1");
    }
  }

  if (ownerDocument.activeElement instanceof HTMLElement && root.contains(ownerDocument.activeElement)) {
    ownerDocument.activeElement.blur();
  }
}

export function restoreHiddenPaneFocus(root: HTMLElement): void {
  const managedElements = root.querySelectorAll<HTMLElement>(`[${HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE}]`);

  for (const element of managedElements) {
    const previousTabIndex = element.getAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE);
    element.removeAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE);

    if (previousTabIndex === "") {
      element.removeAttribute("tabindex");
      continue;
    }

    if (previousTabIndex !== null) {
      element.setAttribute("tabindex", previousTabIndex);
    }
  }
}
