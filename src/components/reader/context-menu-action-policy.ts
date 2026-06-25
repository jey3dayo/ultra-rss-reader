import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { getErrorMessage } from "@/lib/ui/errors";

export const CONTEXT_MENU_ACTION_IDS = {
  accountOpenSettings: "account-open-settings",
  articleAddToReadingList: "article-add-to-reading-list",
  articleCopyLink: "article-copy-link",
  articleOpenBrowser: "article-open-browser",
  articleShareEmail: "article-share-email",
  articleToggleRead: "article-toggle-read",
  articleToggleStar: "article-toggle-star",
  articleListFeedEdit: "article-list-feed-edit",
  feedEdit: "feed-edit",
  feedMarkAllRead: "feed-mark-all-read",
  feedMarkOldUnreadRead: "feed-mark-old-unread-read",
  feedMarkOldUnreadReadDays: "feed-mark-old-unread-read-days",
  feedOpenSite: "feed-open-site",
  feedSetDisplayPreset: "feed-set-display-preset",
  feedUnsubscribe: "feed-unsubscribe",
  folderMarkAllRead: "folder-mark-all-read",
  folderMarkOldUnreadRead: "folder-mark-old-unread-read",
  folderMarkOldUnreadReadDays: "folder-mark-old-unread-read-days",
  folderSetDisplayPreset: "folder-set-display-preset",
  smartRecentClearHistory: "smart-recent-clear-history",
  smartStarredMarkAllRead: "smart-starred-mark-all-read",
  smartStarredUnstarAll: "smart-starred-unstar-all",
  smartUnreadMarkAllRead: "smart-unread-mark-all-read",
  smartUnreadMarkOldUnreadRead: "smart-unread-mark-old-unread-read",
  smartUnreadMarkOldUnreadReadDays: "smart-unread-mark-old-unread-read-days",
  subscriptionsCollapseAllFolders: "subscriptions-collapse-all-folders",
  subscriptionsExpandAllFolders: "subscriptions-expand-all-folders",
  tagAdd: "tag-add",
  tagDelete: "tag-delete",
  tagEdit: "tag-edit",
  tagManage: "tag-manage",
} as const;

export type ContextMenuActionId = (typeof CONTEXT_MENU_ACTION_IDS)[keyof typeof CONTEXT_MENU_ACTION_IDS];

type MenuActionOptions = {
  showToast?: (message: string) => void;
  getToastMessage?: (error: unknown) => string;
};

const reportedMenuActionFailures = new Set<string>();

function menuActionFailureKey(actionId: ContextMenuActionId, error: unknown) {
  return `${actionId}:${getErrorMessage(error)}`;
}

function logMenuActionFailureOnce(actionId: ContextMenuActionId, error: unknown) {
  const key = menuActionFailureKey(actionId, error);
  if (reportedMenuActionFailures.has(key)) {
    return;
  }

  reportedMenuActionFailures.add(key);
  logRuntimeDiagnostic("menu-action", `Menu action failed: ${actionId}`, error);
}

export function formatMenuActionDebugTrace(actionId: ContextMenuActionId, value?: string) {
  return value ? `menu-action ${actionId} value=${value}` : `menu-action ${actionId}`;
}

export function createMenuActionHandler(
  actionId: ContextMenuActionId,
  action: () => void | Promise<void>,
  options: MenuActionOptions = {},
) {
  return () => {
    emitDebugInputTrace(formatMenuActionDebugTrace(actionId));

    void Promise.resolve()
      .then(action)
      .catch((error: unknown) => {
        logMenuActionFailureOnce(actionId, error);
        options.showToast?.((options.getToastMessage ?? getErrorMessage)(error));
      });
  };
}
