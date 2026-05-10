import type { FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import type { SortSubscriptions, StartupFolderExpansionPreference } from "@/schemas/preferences";
import type { FeedTreeViewProps } from "./feed-tree.types";
import type { SidebarDensity } from "./sidebar-density";
import type { SidebarFeedTreeViewMode, SidebarSelection } from "./sidebar-feed-tree.types";

export type SidebarFeedTreeProps = Omit<FeedTreeViewProps, "emptyState" | "unfolderedLabel">;

export type StartupFolderExpansionMode = StartupFolderExpansionPreference;

type SidebarFeedDragStateFeed = {
  account_id: string;
  folder_id: string | null;
};

export type SidebarFeedDragStateParams = {
  canDragFeeds: boolean;
  isFeedsSectionOpen: boolean;
  feedById: Map<string, SidebarFeedDragStateFeed>;
  folderById: Map<string, Pick<FolderDto, "account_id">>;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
};

export type SidebarFeedDragStateResult = {
  draggedFeedId: string | null;
  activeDropTarget: FeedTreeViewProps["activeDropTarget"];
  clearDragState: NonNullable<FeedTreeViewProps["onDragEnd"]>;
  handleDragStartFeed: (feedId: string) => void;
  handleDragEnterFolder: NonNullable<FeedTreeViewProps["onDragEnterFolder"]>;
  handleDragEnterUnfoldered: NonNullable<FeedTreeViewProps["onDragEnterUnfoldered"]>;
  handleDropToFolder: (folderId: string) => Promise<unknown>;
  handleDropToUnfoldered: () => Promise<unknown>;
};

export type SidebarFeedNavigationParams = {
  orderedFeedIds: string[];
  selectedFeedId: string | null;
  expandedFolderIds: Set<string>;
  getFeedFolderId: (feedId: string) => string | null | undefined;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  selectFeed: (feedId: string) => void;
};

export type SidebarStartupFolderExpansionParams = {
  selectedAccountId: string | null;
  expandedFolderIds: Set<string>;
  feedList: FeedDto[];
  folderList: FolderDto[];
  startupFolderExpansion: StartupFolderExpansionMode;
  feedsReady: boolean;
  foldersReady: boolean;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
};

export type SidebarVisibilityFallbackParams = {
  firstFeedId: string | null;
  selection: SidebarSelection;
  tags: TagDto[] | undefined;
  feedsReady: boolean;
  viewMode: SidebarFeedTreeViewMode;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarRecentArticles: boolean;
  showSidebarTags: boolean;
  selectFeed: (feedId: string) => void;
  selectAll: () => void;
  selectSmartView: (kind: SmartViewKind) => void;
  setViewMode: (mode: SidebarFeedTreeViewMode) => void;
};

export type SidebarFeedSectionParams = {
  selectedAccountId: string | null;
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  starredCountByFeedId: ReadonlyMap<string, number>;
  selection: SidebarSelection;
  viewMode: SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: SortSubscriptions;
  grayscaleFavicons: boolean;
  isFeedsSectionOpen: boolean;
  startupFolderExpansion: StartupFolderExpansionMode;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarRecentArticles: boolean;
  showSidebarTags: boolean;
  tags: TagDto[] | undefined;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  selectFeed: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectAll: () => void;
  selectSmartView: (kind: SmartViewKind) => void;
  setViewMode: (mode: SidebarFeedTreeViewMode) => void;
  toggleFolder: (folderId: string) => void;
  displayFavicons: boolean;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
  sidebarDensity: SidebarDensity;
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
};

export type SidebarFeedTreePropsParams = {
  isFeedsSectionOpen: boolean;
  sidebarDensity: SidebarDensity;
  feedTreeFolders: FeedTreeViewProps["folders"];
  unfolderedFeedViews: FeedTreeViewProps["unfolderedFeeds"];
  toggleFolder: FeedTreeViewProps["onToggleFolder"];
  selectFolder: FeedTreeViewProps["onSelectFolder"];
  selectFeed: FeedTreeViewProps["onSelectFeed"];
  markFeedRead: NonNullable<FeedTreeViewProps["onMarkFeedRead"]>;
  markFolderRead: NonNullable<FeedTreeViewProps["onMarkFolderRead"]>;
  displayFavicons: FeedTreeViewProps["displayFavicons"];
  canDragFeeds: boolean;
  draggedFeedId: SidebarFeedDragStateResult["draggedFeedId"];
  activeDropTarget: SidebarFeedDragStateResult["activeDropTarget"];
  handleDragStartFeed: (feedId: string) => void;
  handleDragEnterFolder: SidebarFeedDragStateResult["handleDragEnterFolder"];
  handleDragEnterUnfoldered: SidebarFeedDragStateResult["handleDragEnterUnfoldered"];
  handleDropToFolder: SidebarFeedDragStateResult["handleDropToFolder"];
  handleDropToUnfoldered: SidebarFeedDragStateResult["handleDropToUnfoldered"];
  clearDragState: SidebarFeedDragStateResult["clearDragState"];
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
};

export type SidebarFeedSectionResult = {
  feedTreeProps: SidebarFeedTreeProps;
};
