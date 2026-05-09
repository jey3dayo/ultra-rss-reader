export function isGlobalShortcutTextEditingTarget(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox" ||
    target.getAttribute("role") === "searchbox"
  ) {
    return true;
  }

  return (
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], [role="searchbox"]',
    ) !== null
  );
}
