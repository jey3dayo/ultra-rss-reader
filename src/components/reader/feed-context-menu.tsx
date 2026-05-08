import { Result } from "@praha/byethrow";
import { useCallback, useReducer } from "react";
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
} from "@/lib/article-display";
import { resolveSiteHostLabel } from "@/lib/feed";
import { usePreferencesStore } from "@/stores/preferences-store";
import { FeedContextMenuView } from "./feed-context-menu-view";
import { buildFeedMarkAllReadConfirmation } from "./feed-mark-all-read";
import { RenameDialog } from "./rename-feed-dialog";
import { UnsubscribeDialog } from "./unsubscribe-feed-dialog";

export type FeedContextMenuContentProps = {
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

  const siteHost = resolveSiteHostLabel(feed.site_url, feed.url);
  const selectedDisplayPreset = resolveFeedDisplayPreset(feed);
  const displayPresetOptions = buildFeedDisplayPresetOptions({
    default: t("display_mode_default"),
    standard: t("display_mode_standard"),
    preview: t("display_mode_preview"),
  });

  const handleOpenSite = useCallback(() => {
    const url = feed.site_url || feed.url;
    if (url) {
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      openInBrowser(url, bg).then((result) =>
        Result.pipe(
          result,
          Result.inspectError((e) => console.error("Failed to open site:", e)),
        ),
      );
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
      void updateFeedDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode);
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
    try {
      await deleteFeedMutation.mutateAsync({
        feedId: feed.id,
        title: feed.title,
        onSuccess: () => dispatch({ type: "set-unsubscribe-dialog", value: false }),
      });
    } catch {
      return;
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
        onOpenSite={handleOpenSite}
        onMarkAllRead={handleMarkAllRead}
        onMarkOldUnreadRead={(days) => {
          void markOldUnreadRead(days);
        }}
        onSetDisplayPreset={handleSetDisplayPreset}
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
        onOpenChange={(value) => dispatch({ type: "set-unsubscribe-dialog", value })}
        onConfirm={handleConfirmUnsubscribe}
      />
    </>
  );
}
