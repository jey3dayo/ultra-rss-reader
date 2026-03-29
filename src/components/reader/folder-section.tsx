import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FeedItem, FeedItemView } from "./feed-item";
import { FolderContextMenuContent } from "./folder-context-menu";

function getFolderUnreadCount(feeds: FeedDto[]) {
  return feeds.reduce((sum, feed) => sum + feed.unread_count, 0);
}

export type FolderSectionViewProps = {
  folder: FolderDto;
  feeds: FeedDto[];
  isExpanded: boolean;
  onToggle: (folderId: string) => void;
  selectedFeedId: string | null;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  grayscaleFavicons?: boolean;
  hasContextMenu?: boolean;
  renderTrigger?: (props: {
    children: ReactNode;
    className: string;
    hasContextMenu: boolean;
    isExpanded: boolean;
    onClick: () => void;
  }) => ReactNode;
  renderFeedItem?: (feed: FeedDto) => ReactNode;
};

export function FolderSectionView({
  folder,
  feeds,
  isExpanded,
  onToggle,
  selectedFeedId,
  onSelectFeed,
  displayFavicons,
  grayscaleFavicons = false,
  hasContextMenu = false,
  renderTrigger,
  renderFeedItem,
}: FolderSectionViewProps) {
  const folderUnread = getFolderUnreadCount(feeds);
  const className =
    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent/50";
  const triggerContent = (
    <>
      <div className="flex items-center gap-1">
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-medium">{folder.name}</span>
      </div>
      {folderUnread > 0 && <span className="text-muted-foreground">{folderUnread.toLocaleString()}</span>}
    </>
  );
  const handleToggle = () => onToggle(folder.id);

  const trigger = renderTrigger ? (
    renderTrigger({
      children: triggerContent,
      className,
      hasContextMenu,
      isExpanded,
      onClick: handleToggle,
    })
  ) : (
    <button
      type="button"
      onClick={handleToggle}
      aria-expanded={isExpanded}
      aria-haspopup={hasContextMenu ? "menu" : undefined}
      className={className}
    >
      {triggerContent}
    </button>
  );

  return (
    <div>
      {trigger}
      {isExpanded && (
        <div className="space-y-0.5 pl-3">
          {feeds.map((feed) =>
            renderFeedItem ? (
              renderFeedItem(feed)
            ) : (
              <FeedItemView
                key={feed.id}
                feed={feed}
                isSelected={selectedFeedId === feed.id}
                onSelect={onSelectFeed}
                displayFavicons={displayFavicons}
                grayscaleFavicons={grayscaleFavicons}
                hasContextMenu={true}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function FolderSection(
  props: Omit<FolderSectionViewProps, "hasContextMenu" | "renderTrigger" | "renderFeedItem">,
) {
  const folderUnread = getFolderUnreadCount(props.feeds);

  return (
    <ContextMenu.Root>
      <FolderSectionView
        {...props}
        hasContextMenu={true}
        renderTrigger={({ children, className, hasContextMenu, isExpanded, onClick }) => (
          <ContextMenu.Trigger
            render={<button type="button" />}
            onClick={onClick}
            className={className}
            aria-expanded={isExpanded}
            aria-haspopup={hasContextMenu ? "menu" : undefined}
          >
            {children}
          </ContextMenu.Trigger>
        )}
        renderFeedItem={(feed) => (
          <FeedItem
            key={feed.id}
            feed={feed}
            isSelected={props.selectedFeedId === feed.id}
            onSelect={props.onSelectFeed}
            displayFavicons={props.displayFavicons}
            grayscaleFavicons={props.grayscaleFavicons}
          />
        )}
      />
      <FolderContextMenuContent folder={props.folder} folderUnread={folderUnread} />
    </ContextMenu.Root>
  );
}
