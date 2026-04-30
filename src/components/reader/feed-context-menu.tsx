import { Result } from "@praha/byethrow";
import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { openInBrowser } from "@/api/tauri-commands";
import { useMarkFeedRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  buildFeedDisplayPresetOptions,
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { resolveSiteHostLabel } from "@/lib/feed";
import { usePreferencesStore } from "@/stores/preferences-store";
import { FeedContextMenuView } from "./feed-context-menu-view";
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
  const deleteFeedMutation = useDeleteFeed();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();

  const siteHost = resolveSiteHostLabel(feed.site_url, feed.url);
  const selectedDisplayPreset = feedModesToDisplayPresetOption(
    resolveFeedDisplayOverrides(feed).readerMode,
    resolveFeedDisplayOverrides(feed).webPreviewMode,
  );
  const displayPresetOptions = buildFeedDisplayPresetOptions({
    default: t("display_mode_default"),
    standard: t("display_mode_standard"),
    preview: t("display_mode_preview"),
  });

  const handleOpenSite = () => {
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
  };

  const handleMarkAllRead = () => {
    confirmMarkAllRead({
      count: feed.unread_count,
      onConfirm: () => markFeedRead.mutate(feed.id),
    });
  };

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
        displayModeLabel={t("display_mode")}
        displayPresetOptions={displayPresetOptions}
        selectedDisplayPreset={selectedDisplayPreset}
        unsubscribeLabel={t("unsubscribe_ellipsis")}
        editLabel={t("edit_ellipsis")}
        onOpenSite={handleOpenSite}
        onMarkAllRead={handleMarkAllRead}
        onSetDisplayPreset={(value) => {
          const nextModes = displayPresetToTriStateModes(value as "default" | "standard" | "preview");
          void updateFeedDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode);
        }}
        onUnsubscribe={() => dispatch({ type: "set-unsubscribe-dialog", value: true })}
        onEdit={() => dispatch({ type: "set-rename-dialog", value: true })}
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
