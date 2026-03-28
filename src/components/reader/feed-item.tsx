import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { useState } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { extractSiteHost } from "@/lib/feed";
import { cn } from "@/lib/utils";
import { FeedContextMenuContent } from "./feed-context-menu";

function FeedFavicon({ feed }: { feed: FeedDto }) {
  const [failed, setFailed] = useState(false);
  let host: string | null = null;
  Result.pipe(
    extractSiteHost(feed.site_url, feed.url),
    Result.inspect((h) => {
      host = h;
    }),
  );

  if (!host || failed) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
        {feed.title.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      className="h-4 w-4 shrink-0 rounded"
      onError={() => setFailed(true)}
    />
  );
}

export function FeedItem({
  feed,
  isSelected,
  onSelect,
  displayFavicons,
}: {
  feed: FeedDto;
  isSelected: boolean;
  onSelect: (feedId: string) => void;
  displayFavicons: boolean;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={<button type="button" />}
        onClick={() => onSelect(feed.id)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
          isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {displayFavicons && <FeedFavicon feed={feed} />}
          <span className="truncate">{feed.title}</span>
        </div>
        {feed.unread_count > 0 && <span className="ml-2 shrink-0 text-muted-foreground">{feed.unread_count}</span>}
      </ContextMenu.Trigger>
      <FeedContextMenuContent feed={feed} />
    </ContextMenu.Root>
  );
}
