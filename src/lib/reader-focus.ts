import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import { queryElementByDataAttribute } from "./dom/data-attribute";
import type { FocusedPane } from "./layout/layout-state.types";

export const SIDEBAR_SELECTED_TARGET_ATTRIBUTE = "data-sidebar-selected-target";
export const SIDEBAR_FALLBACK_TARGET_ATTRIBUTE = "data-sidebar-fallback-target";
export const ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE = "data-account-pane-selected-target";
export const ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE = "data-account-pane-navigation-target";
export const SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE = "data-sidebar-smart-view-kind";

type ReaderFocusTargetAttribute =
  | typeof SIDEBAR_SELECTED_TARGET_ATTRIBUTE
  | typeof SIDEBAR_FALLBACK_TARGET_ATTRIBUTE
  | typeof ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE
  | typeof ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE;
type ReaderFocusReturnAction = "focus-sidebar" | "focus-list";
type ReaderFocusRetryGenerationKey = "article-list-row" | "sidebar-smart-view";
type ReaderFocusRetryCleanup = () => void;
type ReaderFocusFrameCleanup = () => void;

const READER_FOCUS_FRAME_SCHEDULE_WARNING = "Failed to schedule reader focus frame.";

const readerFocusRetryGenerations: Record<ReaderFocusRetryGenerationKey, number> = {
  "article-list-row": 0,
  "sidebar-smart-view": 0,
};

function isTextEditingTarget(target: Element | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.getAttribute("contenteditable") === "true")
  );
}

function hasActiveTextEditingTarget(): boolean {
  return typeof document !== "undefined" && isTextEditingTarget(document.activeElement);
}

export function getReaderFocusBooleanSelector(attribute: ReaderFocusTargetAttribute): string {
  return `[${attribute}="true"]`;
}

export function getAccountPaneNavigationTargetSelector(): string {
  return getReaderFocusBooleanSelector(ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE);
}

export function getAccountPaneSelectedTargetSelector(): string {
  return getReaderFocusBooleanSelector(ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE);
}

export function getSidebarSmartViewKindSelector(kind: SmartViewKind): string {
  return `[${SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE}="${kind}"]`;
}

export function scheduleReaderFocusFrame(callback: () => void): ReaderFocusFrameCleanup {
  const timeoutFallback = () => {
    if (typeof window === "undefined" || typeof window.setTimeout !== "function") {
      return null;
    }

    return window.setTimeout(callback, 0);
  };

  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    const timeoutId = timeoutFallback();
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }

  try {
    const frameId = window.requestAnimationFrame(callback);
    return () => {
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      }
    };
  } catch (error) {
    console.warn(READER_FOCUS_FRAME_SCHEDULE_WARNING, error);
    const timeoutId = timeoutFallback();
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }
}

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
  if (isReaderFocusTargetDisabled(target) || (hasActiveTextEditingTarget() && document.activeElement !== target)) {
    return false;
  }

  try {
    target.focus({ preventScroll: true });
  } catch {
    return false;
  }
  scrollReaderFocusTargetIntoView(target);
  return true;
}

function focusFirstAvailableTarget(targets: Array<HTMLElement | null>): boolean {
  return targets.some((target) => (target ? focusElement(target) : false));
}

function focusTargetWhenReady(params: {
  generationKey: ReaderFocusRetryGenerationKey;
  focusTarget: () => boolean;
  focusFallback: () => void;
  retry: (attemptsRemaining: number) => ReaderFocusRetryCleanup;
  attemptsRemaining: number;
}): ReaderFocusRetryCleanup {
  readerFocusRetryGenerations[params.generationKey] += 1;
  const generation = readerFocusRetryGenerations[params.generationKey];
  let timeoutId: number | null = null;
  const cleanup = () => {
    if (readerFocusRetryGenerations[params.generationKey] === generation) {
      readerFocusRetryGenerations[params.generationKey] += 1;
    }
    if (timeoutId !== null && typeof window !== "undefined") {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  if (params.focusTarget()) {
    return cleanup;
  }

  if (params.attemptsRemaining <= 1) {
    params.focusFallback();
    return cleanup;
  }

  if (typeof window === "undefined" || typeof window.setTimeout !== "function") {
    params.focusFallback();
    return cleanup;
  }

  timeoutId = window.setTimeout(() => {
    if (readerFocusRetryGenerations[params.generationKey] !== generation) {
      return;
    }
    timeoutId = null;
    params.retry(params.attemptsRemaining - 1);
  }, 50);
  return cleanup;
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

export function resolveReaderFocusReturnAction(params: {
  key: string;
  focusedPane: FocusedPane;
  target: Element | null;
  targetIsTextEditing: boolean;
}): ReaderFocusReturnAction | null {
  if (params.key !== "ArrowLeft" || params.focusedPane !== "content" || params.targetIsTextEditing) {
    return null;
  }

  if (isArticleListPaneTarget(params.target)) {
    return "focus-sidebar";
  }

  if (!isArticleListRowTarget(params.target)) {
    return "focus-list";
  }

  return null;
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

export function focusArticleListRowTargetWhenReady(
  selectedArticleId: string | null,
  attemptsRemaining = 12,
): ReaderFocusRetryCleanup {
  return focusTargetWhenReady({
    generationKey: "article-list-row",
    focusTarget: () => focusArticleListRowTarget(selectedArticleId),
    focusFallback: () => {
      focusArticleListTarget(selectedArticleId);
    },
    retry: (nextAttemptsRemaining) => focusArticleListRowTargetWhenReady(selectedArticleId, nextAttemptsRemaining),
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
    document.querySelector<HTMLElement>(getReaderFocusBooleanSelector(SIDEBAR_SELECTED_TARGET_ATTRIBUTE)),
    document.querySelector<HTMLElement>(getReaderFocusBooleanSelector(SIDEBAR_FALLBACK_TARGET_ATTRIBUTE)),
  ]);
}

export function focusSidebarSmartViewTarget(kind: SmartViewKind): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const target = document.querySelector<HTMLElement>(getSidebarSmartViewKindSelector(kind));
  return target ? focusElement(target) : false;
}

export function focusSidebarSmartViewTargetWhenReady(
  kind: SmartViewKind,
  attemptsRemaining = 12,
): ReaderFocusRetryCleanup {
  return focusTargetWhenReady({
    generationKey: "sidebar-smart-view",
    focusTarget: () => focusSidebarSmartViewTarget(kind),
    focusFallback: focusSelectedSidebarTarget,
    retry: (nextAttemptsRemaining) => focusSidebarSmartViewTargetWhenReady(kind, nextAttemptsRemaining),
    attemptsRemaining,
  });
}

export function focusSelectedAccountPaneTarget(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return focusFirstAvailableTarget([
    document.querySelector<HTMLElement>(getAccountPaneSelectedTargetSelector()),
    document.querySelector<HTMLElement>(getAccountPaneNavigationTargetSelector()),
  ]);
}
