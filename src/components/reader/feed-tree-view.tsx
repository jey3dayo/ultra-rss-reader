import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { cn } from "@/lib/utils";
import { FeedItem } from "./feed-item";
import { FolderSection } from "./folder-section";

export type FeedTreeFolderViewModel = {
  folder: FolderDto;
  feeds: FeedDto[];
  isExpanded: boolean;
};

export type FeedTreeViewProps = {
  feedsLabel: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedDto[];
  selectedFeedId: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  grayscaleFavicons?: boolean;
  emptyState: ReactNode;
};

export function FeedTreeView({
  feedsLabel,
  isOpen,
  onToggleOpen,
  folders,
  unfolderedFeeds,
  selectedFeedId,
  onToggleFolder,
  onSelectFeed,
  displayFavicons,
  grayscaleFavicons = false,
  emptyState,
}: FeedTreeViewProps) {
  const hasFeeds = folders.length > 0 || unfolderedFeeds.length > 0;

  return (
    <div>
      <div className="px-2 py-2">
        <button type="button" onClick={onToggleOpen} className="flex w-full items-center justify-between px-2 py-1">
          <span className="text-sm font-medium text-sidebar-foreground">{feedsLabel}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
        </button>
      </div>

      <div className="space-y-0.5 px-2">
        {hasFeeds ? (
          isOpen ? (
            <>
              {folders.map(({ folder, feeds, isExpanded }) => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  feeds={feeds}
                  isExpanded={isExpanded}
                  onToggle={onToggleFolder}
                  selectedFeedId={selectedFeedId}
                  onSelectFeed={onSelectFeed}
                  displayFavicons={displayFavicons}
                  grayscaleFavicons={grayscaleFavicons}
                />
              ))}
              {unfolderedFeeds.map((feed) => (
                <FeedItem
                  key={feed.id}
                  feed={feed}
                  isSelected={selectedFeedId === feed.id}
                  onSelect={onSelectFeed}
                  displayFavicons={displayFavicons}
                  grayscaleFavicons={grayscaleFavicons}
                />
              ))}
            </>
          ) : null
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">{emptyState}</div>
        )}
      </div>
    </div>
  );
}
