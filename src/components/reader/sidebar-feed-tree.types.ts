import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import type {
  FeedTreeFeedViewModel,
  FeedTreeFolderViewModel,
  SidebarFeedTreeViewMode,
} from "@/lib/sidebar/sidebar-feed-tree";
import type { SortSubscriptions } from "@/schemas/preferences";

export type SidebarSelection = ReaderSelection;

export type { SidebarFeedTreeViewMode } from "@/lib/sidebar/sidebar-feed-tree";

export type UseSidebarFeedTreeParams = {
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  selection: SidebarSelection;
  viewMode: SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: SortSubscriptions;
  grayscaleFavicons: boolean;
  draggedFeedId: string | null;
  starredCountByFeedId?: ReadonlyMap<string, number>;
};

export type UseSidebarFeedTreeResult = {
  feedById: Map<string, FeedDto>;
  feedList: FeedDto[];
  folderList: FolderDto[];
  sortedFolderList: FolderDto[];
  selectedFeedId: string | null;
  selectedFolderId: string | null;
  feedTreeFolders: FeedTreeFolderViewModel[];
  unfolderedFeedViews: FeedTreeFeedViewModel[];
  orderedFeedIds: string[];
};
