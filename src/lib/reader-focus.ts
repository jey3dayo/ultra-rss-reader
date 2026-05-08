import type { SmartViewKind } from "@/lib/smart-view.types";

export const SIDEBAR_SELECTED_TARGET_ATTRIBUTE = "data-sidebar-selected-target";
export const SIDEBAR_FALLBACK_TARGET_ATTRIBUTE = "data-sidebar-fallback-target";
export const ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE = "data-account-pane-selected-target";
export const SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE = "data-sidebar-smart-view-kind";

export type ReaderFocusTargetAttribute =
  | typeof SIDEBAR_SELECTED_TARGET_ATTRIBUTE
  | typeof SIDEBAR_FALLBACK_TARGET_ATTRIBUTE
  | typeof ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE;
export type SidebarSmartViewKindAttribute = typeof SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE;
export type ReaderFocusAttribute = ReaderFocusTargetAttribute | SidebarSmartViewKindAttribute;

function focusElement(target: HTMLElement): boolean {
  if (target.hasAttribute("disabled")) {
    return false;
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  return true;
}

export function focusArticleListTarget(selectedArticleId: string | null): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (focusArticleListRowTarget(selectedArticleId)) {
    return true;
  }

  const listbox = document.querySelector<HTMLElement>('[data-article-list-root="true"]');
  return listbox ? focusElement(listbox) : false;
}

export function focusArticleListRowTarget(selectedArticleId: string | null): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (selectedArticleId) {
    const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${selectedArticleId}"]`);
    if (selectedArticleTarget && focusElement(selectedArticleTarget)) {
      return true;
    }
  }

  const firstArticleTarget = document.querySelector<HTMLElement>('[data-article-id][role="option"]');
  if (firstArticleTarget && focusElement(firstArticleTarget)) {
    return true;
  }

  return false;
}

export function focusArticleListRowTargetWhenReady(selectedArticleId: string | null, attemptsRemaining = 12): void {
  if (focusArticleListRowTarget(selectedArticleId)) {
    return;
  }

  if (attemptsRemaining <= 1) {
    focusArticleListTarget(selectedArticleId);
    return;
  }

  window.setTimeout(() => focusArticleListRowTargetWhenReady(selectedArticleId, attemptsRemaining - 1), 50);
}

export function focusArticleContentTarget(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const articlePane = document.querySelector<HTMLElement>('[data-article-content-pane="true"]');
  return articlePane ? focusElement(articlePane) : false;
}

export function focusSelectedSidebarTarget(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const selectedTarget =
    document.querySelector<HTMLElement>(`[${SIDEBAR_SELECTED_TARGET_ATTRIBUTE}="true"]`) ??
    document.querySelector<HTMLElement>(`[${SIDEBAR_FALLBACK_TARGET_ATTRIBUTE}="true"]`);

  return selectedTarget ? focusElement(selectedTarget) : false;
}

export function focusSidebarSmartViewTarget(kind: SmartViewKind): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const target = document.querySelector<HTMLElement>(`[${SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE}="${kind}"]`);
  return target ? focusElement(target) : false;
}

export function focusSidebarSmartViewTargetWhenReady(kind: SmartViewKind, attemptsRemaining = 12): void {
  if (focusSidebarSmartViewTarget(kind)) {
    return;
  }

  if (attemptsRemaining <= 1) {
    focusSelectedSidebarTarget();
    return;
  }

  window.setTimeout(() => focusSidebarSmartViewTargetWhenReady(kind, attemptsRemaining - 1), 50);
}

export function focusSelectedAccountPaneTarget(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const selectedTarget =
    document.querySelector<HTMLElement>(`[${ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE}="true"]`) ??
    document.querySelector<HTMLElement>("[data-account-pane-navigation-target='true']");

  return selectedTarget ? focusElement(selectedTarget) : false;
}
