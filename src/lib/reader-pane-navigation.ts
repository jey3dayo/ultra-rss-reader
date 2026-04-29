import { useUiStore } from "@/stores/ui-store";
import {
  ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE,
  focusSelectedSidebarTarget,
  focusSidebarSmartViewTargetWhenReady,
} from "./reader-focus";

export type PaneNavigationKey = "ArrowDown" | "ArrowUp" | "ArrowRight" | "Escape" | "Enter";
export const ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE = "data-account-pane-account-id";
export type AccountPaneAccountIdAttribute = typeof ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE;

export function normalizePaneNavigationKey(key: string): PaneNavigationKey | null {
  switch (key) {
    case "ArrowDown":
    case "Down":
      return "ArrowDown";
    case "ArrowUp":
    case "Up":
      return "ArrowUp";
    case "ArrowRight":
    case "Right":
      return "ArrowRight";
    case "Escape":
      return "Escape";
    case "Enter":
      return "Enter";
    default:
      return null;
  }
}

function getAccountPaneNavigationTargets(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-account-pane-navigation-target="true"]'),
  ).filter((target) => !target.disabled && !target.closest('[aria-hidden="true"]'));
}

function getCurrentAccountPaneTarget(targets: HTMLButtonElement[]): HTMLButtonElement | null {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLButtonElement && targets.includes(activeElement)) {
    return activeElement;
  }

  return (
    targets.find((target) => target.getAttribute(ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE) === "true") ??
    targets[0] ??
    null
  );
}

function focusAccountPaneTarget(target: HTMLButtonElement) {
  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

export function focusAdjacentAccountPaneTarget(direction: 1 | -1): boolean {
  const targets = getAccountPaneNavigationTargets();
  const currentTarget = getCurrentAccountPaneTarget(targets);
  if (!currentTarget) {
    return false;
  }

  const currentIndex = targets.indexOf(currentTarget);
  const nextTarget = targets[(currentIndex + direction + targets.length) % targets.length];
  if (!nextTarget) {
    return false;
  }

  focusAccountPaneTarget(nextTarget);
  return true;
}

export function closeAccountPaneAndFocusSidebar() {
  useUiStore.getState().closeAccountPane();
  requestAnimationFrame(() => {
    focusSelectedSidebarTarget();
  });
}

export function selectCurrentAccountPaneTargetAndFocusSidebar(): boolean {
  const targets = getAccountPaneNavigationTargets();
  const currentTarget = getCurrentAccountPaneTarget(targets);
  const accountId = currentTarget?.getAttribute(ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE);
  if (!accountId) {
    return false;
  }

  const store = useUiStore.getState();
  store.selectAccount(accountId);
  store.setFocusedPane("sidebar");
  focusSidebarSmartViewTargetWhenReady("unread");
  return true;
}
