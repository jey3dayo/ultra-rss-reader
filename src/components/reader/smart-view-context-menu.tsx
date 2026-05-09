import { ContextMenu } from "@base-ui/react/context-menu";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import {
  useClearArticleViewHistory,
  useMarkAccountRead,
  useMarkAccountStarredRead,
  useUnstarAccountArticles,
} from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import type { SmartViewItemViewModel } from "@/lib/sidebar/sidebar-smart-views";
import { useUiStore } from "@/stores/ui-store";
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
    showConfirm(t("clear_recent_history"), () => clearArticleViewHistory.mutate(accountId), {
      actionLabel: t("clear_recent_history"),
      variant: "warning",
    });
  }, [accountId, clearArticleViewHistory, showConfirm, t]);

  if (view.kind === "unread") {
    return (
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item
              data-action-id="smart-unread-mark-all-read"
              className={contextMenuStyles.item}
              onClick={handleMarkUnreadRead}
            >
              {t("mark_all_as_read")}
            </ContextMenu.Item>
            <OldUnreadContextMenuItems
              label={t("mark_old_unread_read")}
              dayLabel={(days) => t("old_unread_older_than_days", { count: days })}
              onSelect={(days) => {
                void markOldUnreadRead(days);
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
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item
              data-action-id="smart-starred-mark-all-read"
              className={contextMenuStyles.item}
              onClick={handleMarkStarredRead}
            >
              {t("mark_all_as_read")}
            </ContextMenu.Item>
            <ContextMenu.Item
              data-action-id="smart-starred-unstar-all"
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
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id="smart-recent-clear-history"
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
