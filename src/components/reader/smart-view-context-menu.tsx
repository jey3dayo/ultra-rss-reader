import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import { ContextMenu } from "@/design-system/context-menu";
import {
  useClearArticleViewHistory,
  useMarkAccountRead,
  useMarkAccountStarredRead,
  useUnstarAccountArticles,
} from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import type { SmartViewItemViewModel } from "@/lib/sidebar/sidebar-smart-views";
import { useUiStore } from "@/stores/ui-store";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";
import { OldUnreadContextMenuItems } from "./old-unread-context-menu-items";

type SmartViewContextMenuContentProps = {
  accountId: string;
  view: SmartViewItemViewModel;
};

export function SmartViewContextMenuContent({ accountId, view }: SmartViewContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markAccountRead = useMarkAccountRead();
  const markAccountStarredRead = useMarkAccountStarredRead();
  const markOldUnreadRead = useOldUnreadReadAction("account", accountId);
  const unstarAccountArticles = useUnstarAccountArticles();
  const clearArticleViewHistory = useClearArticleViewHistory();
  const showConfirm = useUiStore((state) => state.showConfirm);
  const showToast = useUiStore((state) => state.showToast);

  const handleMarkUnreadRead = useCallback(() => {
    confirmMarkAllRead({
      count: view.count,
      onConfirm: () => markAccountRead.mutate(accountId),
    });
  }, [accountId, confirmMarkAllRead, markAccountRead, view.count]);

  const handleMarkStarredRead = useCallback(() => {
    confirmMarkAllRead({
      count: view.count,
      onConfirm: () => markAccountStarredRead.mutate(accountId),
    });
  }, [accountId, confirmMarkAllRead, markAccountStarredRead, view.count]);

  const handleUnstarAll = useCallback(() => {
    if (view.count === 0) {
      return;
    }
    showConfirm(t("confirm_unstar_all", { count: view.count }), () => unstarAccountArticles.mutate(accountId), {
      actionLabel: t("unstar_all"),
      variant: "warning",
    });
  }, [accountId, showConfirm, t, unstarAccountArticles, view.count]);

  const handleClearRecentHistory = useCallback(() => {
    showConfirm(t("confirm_clear_recent_history"), () => clearArticleViewHistory.mutate(accountId), {
      actionLabel: t("clear_recent_history"),
      actionAccessibleLabel: `${t("clear_recent_history")}. ${t("confirm_clear_recent_history")}`,
      variant: "destructive",
    });
  }, [accountId, clearArticleViewHistory, showConfirm, t]);

  if (view.kind === "unread") {
    return (
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={contextMenuStyles.positioner}>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.smartUnreadMarkAllRead}
              className={contextMenuStyles.item}
              onClick={handleMarkUnreadRead}
            >
              {t("mark_all_as_read")}
            </ContextMenu.Item>
            <OldUnreadContextMenuItems
              actionId={CONTEXT_MENU_ACTION_IDS.smartUnreadMarkOldUnreadRead}
              dayActionId={CONTEXT_MENU_ACTION_IDS.smartUnreadMarkOldUnreadReadDays}
              label={t("mark_old_unread_read")}
              dayLabel={(days) => t("old_unread_older_than_days", { count: days })}
              onSelect={(days) => {
                createMenuActionHandler(
                  CONTEXT_MENU_ACTION_IDS.smartUnreadMarkOldUnreadReadDays,
                  () => markOldUnreadRead(days),
                  { showToast },
                )();
              }}
            />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    );
  }

  if (view.kind === "starred") {
    return (
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={contextMenuStyles.positioner}>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.smartStarredMarkAllRead}
              className={contextMenuStyles.item}
              onClick={handleMarkStarredRead}
            >
              {t("mark_all_as_read")}
            </ContextMenu.Item>
            <ContextMenu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.smartStarredUnstarAll}
              className={contextMenuStyles.item}
              onClick={handleUnstarAll}
            >
              {t("unstar_all")}
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    );
  }

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className={contextMenuStyles.positioner}>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.smartRecentClearHistory}
            className={contextMenuStyles.destructiveItem}
            onClick={handleClearRecentHistory}
          >
            {t("clear_recent_history")}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
