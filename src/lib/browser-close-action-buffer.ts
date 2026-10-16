import { APP_EVENTS } from "@/constants/events";
import type { AppAction } from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { focusArticleListTarget } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

export type BufferedBrowserCloseAction = Extract<
  AppAction,
  "prev-article" | "next-article" | "prev-feed" | "next-feed"
>;
let browserCloseStuckRecoveryScheduled = false;
/** Emit a navigation event with a direction detail. */
export function emitNavigationEvent(name: string, direction: 1 | -1): void {
  window.dispatchEvent(new CustomEvent(name, { detail: direction }));
}

export function queueBrowserCloseActionIfNeeded(action: BufferedBrowserCloseAction): boolean {
  const store = useUiStore.getState();
  if (store.subscriptionsWorkspace !== null) {
    return true;
  }
  if (!store.browserCloseInFlight) {
    return false;
  }

  store.setPendingBrowserCloseAction(action);
  emitDebugInputTrace(`queue ${action}`);
  scheduleBrowserCloseStuckRecovery();
  return true;
}

function scheduleBrowserCloseStuckRecovery(): void {
  const store = useUiStore.getState();
  if (browserCloseStuckRecoveryScheduled || store.contentMode !== "browser") {
    return;
  }

  browserCloseStuckRecoveryScheduled = true;
  window.setTimeout(() => {
    browserCloseStuckRecoveryScheduled = false;
    const latestStore = useUiStore.getState();
    if (!latestStore.browserCloseInFlight || latestStore.contentMode !== "browser") {
      return;
    }

    const selectedArticleId = latestStore.selectedArticleId;
    const pendingActions = [...latestStore.pendingBrowserCloseActionQueue];
    emitDebugInputTrace("recover browser-close pending");
    latestStore.closeBrowser();
    latestStore.setFocusedPane("list");
    focusArticleListTarget(selectedArticleId);
    flushPendingBrowserCloseAction(pendingActions);
  }, 0);
}

function dispatchBufferedBrowserCloseAction(action: BufferedBrowserCloseAction): void {
  switch (action) {
    case "prev-article":
      emitNavigationEvent(APP_EVENTS.navigateArticle, -1);
      break;
    case "next-article":
      emitNavigationEvent(APP_EVENTS.navigateArticle, 1);
      break;
    case "prev-feed":
      emitNavigationEvent(APP_EVENTS.navigateFeed, -1);
      break;
    case "next-feed":
      emitNavigationEvent(APP_EVENTS.navigateFeed, 1);
      break;
  }
}
export function flushPendingBrowserCloseAction(pendingActionsOverride?: BufferedBrowserCloseAction[]): void {
  const store = useUiStore.getState();
  const pendingActions = pendingActionsOverride ?? [...store.pendingBrowserCloseActionQueue];
  store.setPendingBrowserCloseAction(null);
  store.setBrowserCloseInFlight(false);
  emitDebugInputTrace(`flush ${pendingActions.length === 0 ? "none" : pendingActions.join(",")}`);

  if (pendingActions.length === 0) {
    return;
  }

  for (const pendingAction of pendingActions) {
    dispatchBufferedBrowserCloseAction(pendingAction);
  }
}
