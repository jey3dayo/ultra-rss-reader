import { Result } from "@praha/byethrow";
import { useCallback, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { openInBrowser } from "@/api/tauri-commands";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import { useMarkFeedRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  buildFeedDisplayPresetOptions,
  displayPresetToTriStateModes,
  isFeedDisplayPresetOption,
  resolveFeedDisplayPreset,
} from "@/lib/articles/article-display";
import { resolveSiteHostLabel } from "@/lib/feed/feed";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { FeedContextMenuView } from "./feed-context-menu-view";
import { buildFeedMarkAllReadConfirmation } from "./feed-mark-all-read";
import { RenameDialog } from "./rename-feed-dialog";
import { UnsubscribeDialog } from "./unsubscribe-feed-dialog";

type FeedContextMenuContentProps = {
  feed: FeedDto;
};

type FeedContextMenuState = {
  showRenameDialog: boolean;
  showUnsubscribeDialog: boolean;
};

type FeedContextMenuAction =
  | { type: "set-rename-dialog"; value: boolean }
  | { type: "set-unsubscribe-dialog"; value: boolean };

const initialFeedContextMenuState: FeedContextMenuState = {
  showRenameDialog: false,
  showUnsubscribeDialog: false,
};

function feedContextMenuReducer(state: FeedContextMenuState, action: FeedContextMenuAction): FeedContextMenuState {
  switch (action.type) {
    case "set-rename-dialog":
      return { ...state, showRenameDialog: action.value };
    case "set-unsubscribe-dialog":
      return { ...state, showUnsubscribeDialog: action.value };
    default:
      return state;
  }
}

export function FeedContextMenuContent({ feed }: FeedContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const [state, dispatch] = useReducer(feedContextMenuReducer, initialFeedContextMenuState);
  const { showRenameDialog, showUnsubscribeDialog } = state;
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFeedRead = useMarkFeedRead();
  const markOldUnreadRead = useOldUnreadReadAction("feed", feed.id);
  const deleteFeedMutation = useDeleteFeed();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const showToast = useUiStore((s) => s.showToast);
  const unsubscribePendingRef = useRef(false);
  const [unsubscribePending, setUnsubscribePending] = useState(false);

  const siteHost = resolveSiteHostLabel(feed.site_url, feed.url);
  const selectedDisplayPreset = resolveFeedDisplayPreset(feed);
  const displayPresetOptions = buildFeedDisplayPresetOptions({
    default: t("display_mode_default"),
    standard: t("display_mode_standard"),
    preview: t("display_mode_preview"),
  });

  const handleOpenSite = useCallback(async () => {
    const url = feed.site_url || feed.url;
    if (url) {
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      const result = await openInBrowser(url, bg);
      if (Result.isFailure(result)) {
        throw Result.unwrapError(result);
      }
    }
  }, [feed.site_url, feed.url]);

  const handleMarkAllRead = useCallback(() => {
    confirmMarkAllRead(
      buildFeedMarkAllReadConfirmation({
        feedId: feed.id,
        unreadCount: feed.unread_count,
        onConfirmRead: (feedId) => markFeedRead.mutate(feedId),
      }),
    );
  }, [confirmMarkAllRead, feed.id, feed.unread_count, markFeedRead]);

  const handleSetDisplayPreset = useCallback(
    (value: string) => {
      if (!isFeedDisplayPresetOption(value)) {
        return;
      }

      const nextModes = displayPresetToTriStateModes(value);
      return updateFeedDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode);
    },
    [feed.id, updateFeedDisplaySettings],
  );

  const handleOpenUnsubscribeDialog = useCallback(() => {
    dispatch({ type: "set-unsubscribe-dialog", value: true });
  }, []);

  const handleOpenRenameDialog = useCallback(() => {
    dispatch({ type: "set-rename-dialog", value: true });
  }, []);

  const handleConfirmUnsubscribe = async () => {
    if (unsubscribePendingRef.current) {
      return;
    }

    unsubscribePendingRef.current = true;
    setUnsubscribePending(true);
    try {
      await deleteFeedMutation.mutateAsync({
        feedId: feed.id,
        accountId: feed.account_id,
        title: feed.title,
        onSuccess: () => dispatch({ type: "set-unsubscribe-dialog", value: false }),
      });
    } catch {
      return;
    } finally {
      unsubscribePendingRef.current = false;
      setUnsubscribePending(false);
    }
  };

  return (
    <>
      <FeedContextMenuView
        openSiteLabel={t("open_site", { host: siteHost })}
        markAllReadLabel={t("mark_all_as_read")}
        markOldUnreadReadLabel={t("mark_old_unread_read")}
        oldUnreadDayLabel={(days) => t("old_unread_older_than_days", { count: days })}
        displayModeLabel={t("display_mode")}
        displayPresetOptions={displayPresetOptions}
        selectedDisplayPreset={selectedDisplayPreset}
        unsubscribeLabel={t("unsubscribe_ellipsis")}
        editLabel={t("edit_ellipsis")}
        hasUnreadArticles={feed.unread_count > 0}
        onOpenSite={createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.feedOpenSite, handleOpenSite, { showToast })}
        onMarkAllRead={handleMarkAllRead}
        onMarkOldUnreadRead={(days) => {
          createMenuActionHandler(
            CONTEXT_MENU_ACTION_IDS.feedMarkOldUnreadReadDays,
            async () => {
              await markOldUnreadRead(days);
            },
            {
              showToast,
            },
          )();
        }}
        onSetDisplayPreset={(value) => {
          createMenuActionHandler(
            CONTEXT_MENU_ACTION_IDS.feedSetDisplayPreset,
            async () => {
              await handleSetDisplayPreset(value);
            },
            { showToast },
          )();
        }}
        onUnsubscribe={handleOpenUnsubscribeDialog}
        onEdit={handleOpenRenameDialog}
      />

      <RenameDialog
        feed={feed}
        open={showRenameDialog}
        onOpenChange={(value) => dispatch({ type: "set-rename-dialog", value })}
      />
      <UnsubscribeDialog
        feed={feed}
        open={showUnsubscribeDialog}
        pending={unsubscribePending || deleteFeedMutation.isPending}
        onOpenChange={(value) => dispatch({ type: "set-unsubscribe-dialog", value })}
        onConfirm={handleConfirmUnsubscribe}
      />
    </>
  );
}
