import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { UiSelection } from "@/lib/ui-state.types";
import type { SortSubscriptions } from "@/schemas/preferences";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";

export type SidebarSelection = UiSelection;

export type SidebarFeedTreeViewMode = ViewMode;

export type SidebarSortFeeds = (candidateFeeds: FeedDto[]) => FeedDto[];

export type SidebarFeedTreeViewModelOptions = {
  selectedFeedId: string | null;
  grayscaleFavicons: boolean;
  viewMode: SidebarFeedTreeViewMode;
  starredCountByFeedId: ReadonlyMap<string, number>;
};

export type SidebarFolderFeedVisibilityParams = {
  folderId: string;
  feedsByFolder: Map<string, FeedDto[]>;
  getVisibleFeeds: SidebarSortFeeds;
};

export type SidebarUnfolderedFeedVisibilityParams = {
  unfolderedFeeds: FeedDto[];
  getVisibleFeeds: SidebarSortFeeds;
};

export type SidebarVisibleFeedTreeParams = {
  sortedFolderList: FolderDto[];
  feedsByFolder: Map<string, FeedDto[]>;
  unfolderedFeeds: FeedDto[];
  getVisibleFeeds: SidebarSortFeeds;
};

export type SidebarVisibleFeedTreeResult = {
  visibleFolderFeedsById: Map<string, FeedDto[]>;
  visibleUnfolderedFeeds: FeedDto[];
  orderedFeedIds: string[];
};

export type SidebarFeedTreeFolderBuildParams = {
  sortedFolderList: FolderDto[];
  feedsByFolder: Map<string, FeedDto[]>;
  visibleFolderFeedsById: Map<string, FeedDto[]>;
  expandedFolderIds: ReadonlySet<string>;
  selectedFolderId: string | null;
  selectedFeedId: string | null;
  grayscaleFavicons: boolean;
  viewMode: SidebarFeedTreeViewMode;
  starredCountByFeedId: ReadonlyMap<string, number>;
  hideEmptyFoldersInCurrentView: boolean;
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
