import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { deleteFeed, openInBrowser } from "@/api/tauri-commands";
import { useMarkFeedRead } from "@/hooks/use-articles";
import { extractSiteHost } from "@/lib/feed";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { contextMenuStyles } from "./context-menu-styles";
import { RenameDialog } from "./rename-feed-dialog";
import { UnsubscribeDialog } from "./unsubscribe-feed-dialog";

export function FeedContextMenuContent({ feed }: { feed: FeedDto }) {
  const { t } = useTranslation("reader");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const markFeedRead = useMarkFeedRead();

  const hostResult = extractSiteHost(feed.site_url, feed.url);
  const siteHost = Result.isSuccess(hostResult) ? Result.unwrap(hostResult) : Result.unwrapError(hostResult);

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
    if (feed.unread_count === 0) return;
    const doMark = () => markFeedRead.mutate(feed.id);
    if (askBeforeMarkAll === "true") {
      showConfirm(t("confirm_mark_feed_read", { count: feed.unread_count, title: feed.title }), doMark);
    } else {
      doMark();
    }
  };

  const handleConfirmUnsubscribe = async () => {
    Result.pipe(
      await deleteFeed(feed.id),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["feeds"] });
        showToast(t("unsubscribed_from", { title: feed.title }));
      }),
      Result.inspectError((e) => showToast(t("failed_to_unsubscribe", { message: e.message }))),
    );
    setShowUnsubscribeDialog(false);
  };

  return (
    <>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={handleOpenSite}>
              {t("open_site", { host: siteHost })}
            </ContextMenu.Item>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={handleMarkAllRead}>
              {t("mark_all_as_read")}
            </ContextMenu.Item>
            <ContextMenu.Separator className={contextMenuStyles.separator} />
            <ContextMenu.Item className={contextMenuStyles.item} onClick={() => setShowUnsubscribeDialog(true)}>
              {t("unsubscribe_ellipsis")}
            </ContextMenu.Item>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={() => setShowRenameDialog(true)}>
              {t("edit_ellipsis")}
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>

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
