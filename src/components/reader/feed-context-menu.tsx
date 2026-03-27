import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { deleteFeed, openInBrowser } from "@/api/tauri-commands";
import { extractSiteHost } from "@/lib/feed";
import { useUiStore } from "@/stores/ui-store";
import { RenameDialog } from "./rename-feed-dialog";
import { UnsubscribeDialog } from "./unsubscribe-feed-dialog";

export function FeedContextMenuContent({ feed }: { feed: FeedDto }) {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

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
          <ContextMenu.Popup className="min-w-[200px] rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none">
            <ContextMenu.Item
              className="flex w-full cursor-default items-center rounded-md px-3 py-1.5 outline-none data-highlighted:bg-accent/20"
              onClick={handleOpenSite}
            >
              Open {siteHost}
            </ContextMenu.Item>
            <ContextMenu.Separator className="my-1 h-px bg-border" />
            <ContextMenu.Item
              className="flex w-full cursor-default items-center rounded-md px-3 py-1.5 outline-none data-highlighted:bg-accent/20"
              onClick={() => setShowUnsubscribeDialog(true)}
            >
              Unsubscribe...
            </ContextMenu.Item>
            <ContextMenu.Item
              className="flex w-full cursor-default items-center rounded-md px-3 py-1.5 outline-none data-highlighted:bg-accent/20"
              onClick={() => setShowRenameDialog(true)}
            >
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
