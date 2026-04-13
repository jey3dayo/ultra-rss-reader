import { ContextMenu } from "@base-ui/react/context-menu";
import type { FeedDto } from "@/api/tauri-commands";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import { cn } from "@/lib/utils";
import { FeedContextMenuContent } from "./feed-context-menu";

export type FeedItemViewProps = {
  feed: FeedDto;
  isSelected: boolean;
  onSelect: (feedId: string) => void;
  displayFavicons: boolean;
  grayscaleFavicons?: boolean;
};

export type FeedItemContentProps = {
  feed: FeedDto;
  displayFavicons: boolean;
  grayscaleFavicons: boolean;
};

function getFeedItemClassName(isSelected: boolean) {
  return cn(
    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
    isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
  );
}

function FeedItemContent({ feed, displayFavicons, grayscaleFavicons }: FeedItemContentProps) {
  const leadingVisualSlotClass = "flex h-5 w-5 shrink-0 items-center justify-center";

  return (
    <>
      <div className="flex items-center gap-2 truncate">
        {displayFavicons && (
          <span className={leadingVisualSlotClass}>
            <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.site_url} grayscale={grayscaleFavicons} />
          </span>
        )}
        <span className="truncate">{feed.title}</span>
      </div>
      {feed.unread_count > 0 && <span className="ml-2 shrink-0 text-muted-foreground">{feed.unread_count}</span>}
    </>
  );
}

export function FeedItemView({
  feed,
  isSelected,
  onSelect,
  displayFavicons,
  grayscaleFavicons = false,
}: FeedItemViewProps) {
  return (
    <button type="button" onClick={() => onSelect(feed.id)} className={getFeedItemClassName(isSelected)}>
      <FeedItemContent feed={feed} displayFavicons={displayFavicons} grayscaleFavicons={grayscaleFavicons} />
    </button>
  );
}

export function FeedItem(props: FeedItemViewProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={<button type="button" />}
        onClick={() => props.onSelect(props.feed.id)}
        className={getFeedItemClassName(props.isSelected)}
        aria-haspopup="menu"
      >
        <FeedItemContent
          feed={props.feed}
          displayFavicons={props.displayFavicons}
          grayscaleFavicons={props.grayscaleFavicons ?? false}
        />
      </ContextMenu.Trigger>
      <FeedContextMenuContent feed={props.feed} />
    </ContextMenu.Root>
  );
}
