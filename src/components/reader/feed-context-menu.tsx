import { Result } from "@praha/byethrow";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { openInBrowser } from "@/api/tauri-commands";
import { useMarkFeedRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { extractSiteHost } from "@/lib/feed";
import { usePreferencesStore } from "@/stores/preferences-store";
import { FeedContextMenuView } from "./feed-context-menu-view";
import { RenameDialog } from "./rename-feed-dialog";
import { UnsubscribeDialog } from "./unsubscribe-feed-dialog";

export function FeedContextMenuContent({ feed }: { feed: FeedDto }) {
  const { t } = useTranslation("reader");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFeedRead = useMarkFeedRead();
  const deleteFeedMutation = useDeleteFeed();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();

  const hostResult = extractSiteHost(feed.site_url, feed.url);
  const siteHost = Result.isSuccess(hostResult) ? Result.unwrap(hostResult) : Result.unwrapError(hostResult);
  const selectedDisplayPreset = feedModesToDisplayPresetOption(
    resolveFeedDisplayOverrides(feed).readerMode,
    resolveFeedDisplayOverrides(feed).webPreviewMode,
  );
  const displayPresetOptions = [
    { value: "default", label: t("display_mode_default") },
    { value: "standard", label: t("display_mode_standard") },
    { value: "preview", label: t("display_mode_preview") },
  ];

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
        onSuccess: () => setShowUnsubscribeDialog(false),
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
        onUnsubscribe={() => setShowUnsubscribeDialog(true)}
        onEdit={() => setShowRenameDialog(true)}
      />

      <RenameDialog feed={feed} open={showRenameDialog} onOpenChange={setShowRenameDialog} />
      <UnsubscribeDialog
        feed={feed}
        open={showUnsubscribeDialog}
        onOpenChange={setShowUnsubscribeDialog}
        onConfirm={handleConfirmUnsubscribe}
      />
    </>
  );
}
