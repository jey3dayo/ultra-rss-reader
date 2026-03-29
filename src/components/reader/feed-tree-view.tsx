import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { extractSiteHost } from "@/lib/feed";
import { cn } from "@/lib/utils";

export type FeedTreeFeedViewModel = {
  id: string;
  accountId: string;
  folderId: string | null;
  title: string;
  url: string;
  siteUrl: string;
  unreadCount: number;
  displayMode: string;
  isSelected: boolean;
  grayscaleFavicon: boolean;
};

export type FeedTreeFolderViewModel = {
  id: string;
  name: string;
  accountId: string;
  unreadCount: number;
  isExpanded: boolean;
  feeds: FeedTreeFeedViewModel[];
};

export type FeedTreeViewProps = {
  isOpen: boolean;
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
  onToggleFolder: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  emptyState:
    | {
        kind: "message";
        message: string;
      }
    | {
        kind: "action";
        label: string;
        onAction: () => void;
      };
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
};

function FeedFavicon({
  title,
  url,
  siteUrl,
  grayscale,
}: {
  title: string;
  url: string;
  siteUrl: string;
  grayscale: boolean;
}) {
  const [failed, setFailed] = useState(false);
  let host: string | null = null;
  Result.pipe(
    extractSiteHost(siteUrl, url),
    Result.inspect((h) => {
      host = h;
    }),
  );

  if (!host || failed) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
        {title.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      className={cn("h-4 w-4 shrink-0 rounded", grayscale && "grayscale")}
      onError={() => setFailed(true)}
    />
  );
}

function FeedRow({
  feed,
  displayFavicons,
  onSelectFeed,
  renderFeedContextMenu,
}: {
  feed: FeedTreeFeedViewModel;
  displayFavicons: boolean;
  onSelectFeed: (feedId: string) => void;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
}) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={<button type="button" />}
        onClick={() => onSelectFeed(feed.id)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
          feed.isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {displayFavicons && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.siteUrl} grayscale={feed.grayscaleFavicon} />
            </span>
          )}
          <span className="truncate">{feed.title}</span>
        </div>
        {feed.unreadCount > 0 && <span className="ml-2 shrink-0 text-muted-foreground">{feed.unreadCount}</span>}
      </ContextMenu.Trigger>
      {renderFeedContextMenu?.(feed)}
    </ContextMenu.Root>
  );
}

function FolderSection({
  folder,
  onToggleFolder,
  onSelectFeed,
  displayFavicons,
  renderFolderContextMenu,
  renderFeedContextMenu,
}: {
  folder: FeedTreeFolderViewModel;
  onToggleFolder: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
}) {
  return (
    <div>
      <ContextMenu.Root>
        <ContextMenu.Trigger
          render={<button type="button" />}
          onClick={() => onToggleFolder(folder.id)}
          aria-expanded={folder.isExpanded}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent/50"
        >
          <div className="flex items-center gap-1">
            {folder.isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className="font-medium">{folder.name}</span>
          </div>
          {folder.unreadCount > 0 && (
            <span className="text-muted-foreground">{folder.unreadCount.toLocaleString()}</span>
          )}
        </ContextMenu.Trigger>
        {renderFolderContextMenu?.(folder)}
      </ContextMenu.Root>
      {folder.isExpanded && (
        <div className="space-y-0.5 pl-3">
          {folder.feeds.map((feed) => (
            <FeedRow
              key={feed.id}
              feed={feed}
              displayFavicons={displayFavicons}
              onSelectFeed={onSelectFeed}
              renderFeedContextMenu={renderFeedContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeedTreeView({
  isOpen,
  folders,
  unfolderedFeeds,
  onToggleFolder,
  onSelectFeed,
  displayFavicons,
  emptyState,
  renderFolderContextMenu,
  renderFeedContextMenu,
}: FeedTreeViewProps) {
  const hasFeeds = folders.length > 0 || unfolderedFeeds.length > 0;

  if (!hasFeeds) {
    return (
      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
        {emptyState.kind === "message" ? (
          emptyState.message
        ) : (
          <button
            type="button"
            onClick={emptyState.onAction}
            className="text-muted-foreground underline decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/50"
          >
            {emptyState.label}
          </button>
        )}
      </div>
    );
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="space-y-0.5 px-2">
      {folders.map((folder) => (
        <FolderSection
          key={folder.id}
          folder={folder}
          onToggleFolder={onToggleFolder}
          onSelectFeed={onSelectFeed}
          displayFavicons={displayFavicons}
          renderFolderContextMenu={renderFolderContextMenu}
          renderFeedContextMenu={renderFeedContextMenu}
        />
      ))}
      {unfolderedFeeds.map((feed) => (
        <FeedRow
          key={feed.id}
          feed={feed}
          displayFavicons={displayFavicons}
          onSelectFeed={onSelectFeed}
          renderFeedContextMenu={renderFeedContextMenu}
        />
      ))}
    </div>
  );
}
