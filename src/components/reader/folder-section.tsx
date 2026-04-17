import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
};

export type FolderSectionTriggerContentProps = {
  folderName: string;
  folderUnread: number;
  isExpanded: boolean;
};

function getFolderTriggerClassName() {
  return "flex min-h-9 w-full items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-sidebar-accent/28";
}

function FolderSectionTriggerContent({ folderName, folderUnread, isExpanded }: FolderSectionTriggerContentProps) {
  return (
    <>
      <div className="flex items-center gap-1">
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-medium">{folderName}</span>
      </div>
      {folderUnread > 0 && <span className="text-foreground-soft">{folderUnread.toLocaleString()}</span>}
    </>
  );
}

export function FolderSectionView({
  folder,
  feeds,
  isExpanded,
  onToggle,
  selectedFeedId,
  onSelectFeed,
  displayFavicons,
  grayscaleFavicons = false,
}: FolderSectionViewProps) {
  const folderUnread = getFolderUnreadCount(feeds);

  return (
    <Collapsible open={isExpanded}>
      <CollapsibleTrigger
        onClick={() => onToggle(folder.id)}
        className={getFolderTriggerClassName()}
        aria-expanded={isExpanded}
      >
        <FolderSectionTriggerContent folderName={folder.name} folderUnread={folderUnread} isExpanded={isExpanded} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 pl-3">
          {feeds.map((feed) => (
            <FeedItemView
              key={feed.id}
              feed={feed}
              isSelected={selectedFeedId === feed.id}
              onSelect={onSelectFeed}
              displayFavicons={displayFavicons}
              grayscaleFavicons={grayscaleFavicons}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FolderSection(props: FolderSectionViewProps) {
  const folderUnread = getFolderUnreadCount(props.feeds);

  return (
    <Collapsible open={props.isExpanded}>
      <ContextMenu.Root>
        <ContextMenu.Trigger render={<div />}>
          <CollapsibleTrigger
            onClick={() => props.onToggle(props.folder.id)}
            className={getFolderTriggerClassName()}
            aria-expanded={props.isExpanded}
            aria-haspopup="menu"
          >
            <FolderSectionTriggerContent
              folderName={props.folder.name}
              folderUnread={folderUnread}
              isExpanded={props.isExpanded}
            />
          </CollapsibleTrigger>
        </ContextMenu.Trigger>
        <FolderContextMenuContent folder={props.folder} folderUnread={folderUnread} />
      </ContextMenu.Root>
      <CollapsibleContent>
        <div className="space-y-0.5 pl-3">
          {props.feeds.map((feed) => (
            <FeedItem
              key={feed.id}
              feed={feed}
              isSelected={props.selectedFeedId === feed.id}
              onSelect={props.onSelectFeed}
              displayFavicons={props.displayFavicons}
              grayscaleFavicons={props.grayscaleFavicons}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
