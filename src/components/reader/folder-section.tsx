import { ChevronDown, ChevronRight } from "lucide-react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FeedItem } from "./feed-item";

export function FolderSection({
  folder,
  feeds,
  isExpanded,
  onToggle,
  selectedFeedId,
  onSelectFeed,
  displayFavicons,
}: {
  folder: FolderDto;
  feeds: FeedDto[];
  isExpanded: boolean;
  onToggle: (folderId: string) => void;
  selectedFeedId: string | null;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
}) {
  const folderUnread = feeds.reduce((sum, f) => sum + f.unread_count, 0);

  return (
    <Collapsible open={isExpanded}>
      <CollapsibleTrigger
        onClick={() => onToggle(folder.id)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent/50"
      >
        <div className="flex items-center gap-1">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="font-medium">{folder.name}</span>
        </div>
        {folderUnread > 0 && <span className="text-muted-foreground">{folderUnread.toLocaleString()}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 pl-3">
          {feeds.map((feed) => (
            <FeedItem
              key={feed.id}
              feed={feed}
              isSelected={selectedFeedId === feed.id}
              onSelect={onSelectFeed}
              displayFavicons={displayFavicons}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
