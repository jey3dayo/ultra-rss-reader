import { ChevronDown, ChevronRight } from "lucide-react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, MotionNumber } from "@/design-system";
import { sumUnreadCounts } from "@/lib/sidebar/sidebar";
import { FeedItemView } from "./feed-item";

function getFolderUnreadCount(feeds: FeedDto[]) {
  return sumUnreadCounts(feeds);
}

type FolderSectionViewProps = {
  folder: FolderDto;
  feeds: FeedDto[];
  isExpanded: boolean;
  onToggle: (folderId: string) => void;
  selectedFeedId: string | null;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  grayscaleFavicons?: boolean;
};

type FolderSectionTriggerContentProps = {
  folderName: string;
  folderUnread: number;
  isExpanded: boolean;
};

function getFolderTriggerClassName() {
  return "flex min-h-11 w-full items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-[var(--sidebar-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:bg-[var(--sidebar-hover-surface)]";
}

function FolderSectionTriggerContent({ folderName, folderUnread, isExpanded }: FolderSectionTriggerContentProps) {
  return (
    <>
      <div className="flex items-center gap-1">
        {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="font-medium">{folderName}</span>
      </div>
      {folderUnread > 0 && <MotionNumber value={folderUnread.toLocaleString()} className="text-foreground-soft" />}
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
