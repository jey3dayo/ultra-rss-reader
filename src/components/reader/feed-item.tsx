import { ContextMenu } from "@base-ui/react/context-menu";
import type { FeedDto } from "@/api/tauri-commands";
import { cn } from "@/lib/utils";
import { FeedContextMenuContent } from "./feed-context-menu";

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
          {displayFavicons && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent/20 text-[10px] font-medium text-accent">
              {feed.title.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate">{feed.title}</span>
        </div>
        {feed.unread_count > 0 && <span className="ml-2 shrink-0 text-muted-foreground">{feed.unread_count}</span>}
      </ContextMenu.Trigger>
      <FeedContextMenuContent feed={feed} />
    </ContextMenu.Root>
  );
}
