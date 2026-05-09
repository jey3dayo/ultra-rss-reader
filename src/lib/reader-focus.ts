import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import { queryElementByDataAttribute } from "./dom/data-attribute";

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

export function isReaderFocusTargetDisabled(target: HTMLElement): boolean {
  return target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true";
}

export function scrollReaderFocusTargetIntoView(target: HTMLElement): void {
  try {
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  } catch {
    // Focus already moved; scroll failures should not break keyboard recovery.
  }
}

function focusElement(target: HTMLElement): boolean {
  if (isReaderFocusTargetDisabled(target)) {
    return false;
  }

  target.focus({ preventScroll: true });
  scrollReaderFocusTargetIntoView(target);
  return true;
}

function focusFirstAvailableTarget(targets: Array<HTMLElement | null>): boolean {
  return targets.some((target) => (target ? focusElement(target) : false));
}

function focusTargetWhenReady(params: {
  focusTarget: () => boolean;
  focusFallback: () => void;
  retry: () => void;
  attemptsRemaining: number;
}) {
  if (params.focusTarget()) {
    return;
  }

  if (params.attemptsRemaining <= 1) {
    params.focusFallback();
    return;
  }

  window.setTimeout(params.retry, 50);
}

export function isSidebarPaneTarget(target: Element | null): boolean {
  return Boolean(target?.closest('[data-sidebar-pane="true"]'));
}

export function isArticleListPaneTarget(target: Element | null): boolean {
  return Boolean(target?.closest('[data-article-list-pane="true"]'));
}

export function isArticleListRowTarget(target: Element | null): boolean {
  return Boolean(target?.closest('[role="option"][data-article-id]'));
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
    const selectedArticleTarget = queryElementByDataAttribute<HTMLElement>(
      document,
      "data-article-id",
      selectedArticleId,
    );
    if (selectedArticleTarget && focusElement(selectedArticleTarget)) {
      return true;
    }
  }

  const firstArticleTarget = Array.from(
    document.querySelectorAll<HTMLElement>('[data-article-id][role="option"]'),
  ).find((target) => focusElement(target));
  if (firstArticleTarget) {
    return true;
  }

  return false;
}

export function focusArticleListRowTargetWhenReady(selectedArticleId: string | null, attemptsRemaining = 12): void {
  focusTargetWhenReady({
    focusTarget: () => focusArticleListRowTarget(selectedArticleId),
    focusFallback: () => {
      focusArticleListTarget(selectedArticleId);
    },
    retry: () => focusArticleListRowTargetWhenReady(selectedArticleId, attemptsRemaining - 1),
    attemptsRemaining,
  });
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

  return focusFirstAvailableTarget([
    document.querySelector<HTMLElement>(`[${SIDEBAR_SELECTED_TARGET_ATTRIBUTE}="true"]`),
    document.querySelector<HTMLElement>(`[${SIDEBAR_FALLBACK_TARGET_ATTRIBUTE}="true"]`),
  ]);
}

export function focusSidebarSmartViewTarget(kind: SmartViewKind): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const target = document.querySelector<HTMLElement>(`[${SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE}="${kind}"]`);
  return target ? focusElement(target) : false;
}

export function focusSidebarSmartViewTargetWhenReady(kind: SmartViewKind, attemptsRemaining = 12): void {
  focusTargetWhenReady({
    focusTarget: () => focusSidebarSmartViewTarget(kind),
    focusFallback: focusSelectedSidebarTarget,
    retry: () => focusSidebarSmartViewTargetWhenReady(kind, attemptsRemaining - 1),
    attemptsRemaining,
  });
}

export function focusSelectedAccountPaneTarget(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return focusFirstAvailableTarget([
    document.querySelector<HTMLElement>(`[${ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE}="true"]`),
    document.querySelector<HTMLElement>("[data-account-pane-navigation-target='true']"),
  ]);
}
