import type { FeedDto } from "@/api/tauri-commands";
import { FeedFavicon, MotionNumber, NavRowButton } from "@/design-system";
import { cn } from "@/lib/utils";
import { FeedContextMenuTrigger } from "./feed-context-menu-trigger";

type FeedItemViewProps = {
  feed: FeedDto;
  isSelected: boolean;
  onSelect: (feedId: string) => void;
  displayFavicons: boolean;
  grayscaleFavicons?: boolean;
};

type FeedItemContentProps = {
  feed: FeedDto;
  displayFavicons: boolean;
  grayscaleFavicons: boolean;
};

function getFeedItemClassName(isSelected: boolean) {
  return cn(
    "motion-feed-selection-marker relative min-h-11 items-center overflow-hidden rounded-md px-2 py-1 text-sm before:absolute before:inset-y-1.5 before:left-0 before:w-1.5 before:origin-center before:rounded-full before:bg-border-strong hover:bg-[var(--sidebar-hover-surface)]",
    isSelected
      ? "border border-border-strong bg-surface-selected text-sidebar-accent-foreground shadow-none"
      : "text-sidebar-foreground",
  );
}

function getFeedItemButtonProps({ feed, displayFavicons, grayscaleFavicons }: FeedItemContentProps) {
  return {
    leading: displayFavicons ? (
      <span className="flex size-5 shrink-0 items-center justify-center">
        <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.site_url} grayscale={grayscaleFavicons} />
      </span>
    ) : undefined,
    title: <span className="truncate">{feed.title}</span>,
    trailing:
      feed.unread_count > 0 ? (
        <MotionNumber key={`${feed.id}:${feed.unread_count}`} value={feed.unread_count} className="inline-flex" />
      ) : undefined,
  };
}

export function FeedItemView({
  feed,
  isSelected,
  onSelect,
  displayFavicons,
  grayscaleFavicons = false,
}: FeedItemViewProps) {
  const buttonProps = getFeedItemButtonProps({ feed, displayFavicons, grayscaleFavicons });
  return (
    <NavRowButton
      tone="sidebar"
      selected={isSelected}
      onClick={() => onSelect(feed.id)}
      className={getFeedItemClassName(isSelected)}
      {...buttonProps}
    />
  );
}

export function FeedItem(props: FeedItemViewProps) {
  const buttonProps = getFeedItemButtonProps({
    feed: props.feed,
    displayFavicons: props.displayFavicons,
    grayscaleFavicons: props.grayscaleFavicons ?? false,
  });
  return (
    <FeedContextMenuTrigger
      feed={props.feed}
      onSelect={() => props.onSelect(props.feed.id)}
      render={
        <NavRowButton
          tone="sidebar"
          selected={props.isSelected}
          className={getFeedItemClassName(props.isSelected)}
          aria-haspopup="menu"
          {...buttonProps}
        />
      }
    />
  );
}
