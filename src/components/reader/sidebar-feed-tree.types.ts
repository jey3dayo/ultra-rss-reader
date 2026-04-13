import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { SortSubscriptions } from "@/stores/preferences-store";
import type { UiSelection } from "@/stores/ui-store";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";

export type SidebarSelection = UiSelection;

export type SidebarFeedTreeViewMode = "all" | "unread" | "starred";

export type SidebarSortFeeds = (candidateFeeds: FeedDto[]) => FeedDto[];

export type SidebarFeedTreeViewModelOptions = {
  selectedFeedId: string | null;
  grayscaleFavicons: boolean;
};

export type UseSidebarFeedTreeParams = {
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  selection: SidebarSelection;
  viewMode: SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: SortSubscriptions;
  grayscaleFavicons: boolean;
  draggedFeedId: string | null;
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
