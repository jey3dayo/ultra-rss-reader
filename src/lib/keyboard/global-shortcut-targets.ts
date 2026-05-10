import type { AppAction } from "@/lib/app-actions";

const globalShortcutIgnoredKeys = new Set(["Dead", "Unidentified", "Process"]);
const modalAllowedMenuActions = new Set<AppAction>(["check-for-updates", "sync-all", "toggle-fullscreen"]);

type GlobalShortcutKeyboardEvent = {
  key: string;
  altKey?: boolean;
  isComposing?: boolean;
};

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

export function shouldIgnoreGlobalShortcutKeyboardEvent(event: GlobalShortcutKeyboardEvent): boolean {
  return event.isComposing === true || event.altKey === true || globalShortcutIgnoredKeys.has(event.key);
}

export function isModalBlockedMenuAction(action: AppAction): boolean {
  return !modalAllowedMenuActions.has(action);
}
