import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const markFeedRead = useMarkFeedRead();

  const hostResult = extractSiteHost(feed.site_url, feed.url);
  const siteHost = Result.isSuccess(hostResult) ? Result.unwrap(hostResult) : Result.unwrapError(hostResult);

  const handleOpenSite = () => {
    const url = feed.site_url || feed.url;
    if (url) {
      openInBrowser(url).then((result) =>
        Result.pipe(
          result,
          Result.inspectError((e) => console.error("Failed to open site:", e)),
        ),
      );
    }
  };

  const handleMarkAllRead = () => {
    if (feed.unread_count === 0) return;
    if (askBeforeMarkAll === "true") {
      if (!window.confirm(`Mark ${feed.unread_count} articles in "${feed.title}" as read?`)) return;
    }
    markFeedRead.mutate(feed.id);
  };

  const handleConfirmUnsubscribe = async () => {
    Result.pipe(
      await deleteFeed(feed.id),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["feeds"] });
        showToast(`Unsubscribed from ${feed.title}`);
      }),
      Result.inspectError((e) => showToast(`Failed to unsubscribe: ${e.message}`)),
    );
    setShowUnsubscribeDialog(false);
  };

  return (
    <>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={handleOpenSite}>
              Open {siteHost}
            </ContextMenu.Item>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={handleMarkAllRead}>
              Mark All as Read
            </ContextMenu.Item>
            <ContextMenu.Separator className={contextMenuStyles.separator} />
            <ContextMenu.Item className={contextMenuStyles.item} onClick={() => setShowUnsubscribeDialog(true)}>
              Unsubscribe...
            </ContextMenu.Item>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={() => setShowRenameDialog(true)}>
              Edit...
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
