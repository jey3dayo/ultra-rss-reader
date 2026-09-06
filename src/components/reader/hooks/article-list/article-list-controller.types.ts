import type { TFunction } from "i18next";
import type { KeyboardEvent, RefObject } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { WebPreviewSessionMode } from "@/lib/articles/article-display";
import type { KeyboardShortcutPrefs } from "@/lib/keyboard/keyboard-shortcuts";
import type { ContentMode, FocusedPane, LayoutMode } from "@/lib/layout/layout-state.types";
import type { ReaderSourcePlan } from "@/lib/reader/reader-query";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import type { ArticleGroupsViewGroup } from "../../article-groups-view";
import type { ArticleListBodyProps } from "../../article-list-body";
import type { ArticleListFooterProps } from "../../article-list-footer";
import type { ArticleListHeaderProps } from "../../article-list-header";
import type { ArticleListSetupState } from "./use-article-list-body-props";

export type ArticleListSelection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: SmartViewKind }
  | { type: "tag"; tagId: string }
  | { type: "all" };

export type UseArticleListViewPropsResult = {
  layoutMode: LayoutMode;
  contentMode: ContentMode;
  headerProps: ArticleListHeaderProps;
  bodyProps: ArticleListBodyProps;
  footerProps: ArticleListFooterProps;
};

export type UseArticleListInteractionsParams = {
  filteredArticles: ArticleDto[];
  selectedArticleId: string | null;
  selectArticle: (articleId: string) => void;
  clearArticle: () => void;
  openSidebar: () => void;
  toggleSidebar: () => void;
  openSearch: () => void;
  handleMarkAllRead: () => void;
  keyboardPrefs: KeyboardShortcutPrefs;
  fetchNextPage?: () => Promise<unknown>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isSearchVisible?: boolean;
};

export type UseArticleListInteractionsResult = {
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  handleListKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export type UseArticleListViewStateParams = {
  selection: ArticleListSelection;
  selectedAccountId: string | null;
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
  accountCount?: number;
  feedCount?: number;
  isLoadingFeedArticles: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingFolderArticles: boolean;
  isLoadingRecentArticles: boolean;
  isLoadingTagArticles: boolean;
  showSearch: boolean;
  trimmedDebouncedQuery: string;
  searchResults: unknown[] | undefined;
  isSearching: boolean;
  filteredArticleCount: number;
};

export type UseArticleListViewStateResult = {
  footerModes: ReadonlyArray<ViewMode>;
  footerDisabledModes: ReadonlyArray<ViewMode>;
  isPrimarySourceLoading: boolean;
  isSearchLoading: boolean;
  isSearchEmptyState: boolean;
  setupEmptyState: ArticleListSetupState;
};

export type UseArticleListViewPropsParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  selection: ArticleListSelection;
  layoutMode: LayoutMode;
  contentMode: ContentMode;
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  handleMarkAllRead: () => void;
  handleToggleSearch: () => void;
  handleCloseSearch: () => void;
  setSearchQuery: (value: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  handleListKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
  isLoadingFeedArticles: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingFolderArticles: boolean;
  isLoadingRecentArticles: boolean;
  isLoadingTagArticles: boolean;
  trimmedDebouncedQuery: string;
  contentMotionKey: ArticleListBodyProps["contentMotionKey"];
  articleGroups: ArticleGroupsViewGroup[];
  feeds?: FeedDto[];
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  selectArticle: (articleId: string) => void;
  onManageSelectedFeed?: (() => void) | null;
  effectiveViewMode: ViewMode;
  setViewMode: (viewMode: ViewMode) => void;
} & Pick<
  UseArticleListHeaderControlsResult,
  "showSidebarButton" | "sidebarButtonLabel" | "sidebarButtonText" | "isSidebarVisible" | "handleSidebarToggle"
> &
  Pick<
    UseArticleListViewStateResult,
    "footerModes" | "footerDisabledModes" | "isSearchLoading" | "isSearchEmptyState" | "setupEmptyState"
  >;

export type ArticleListPresentationTranslators = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  ts: TFunction<"sidebar">;
};

export type ArticleListPresentationSource = {
  selection: ArticleListSelection;
  selectedAccountId: string | null;
  accountCount?: number;
  feeds: FeedDto[] | undefined;
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
  filteredArticles: ArticleDto[];
  groupedArticles: Record<string, ArticleDto[]>;
  groupBy: string;
  feedNameMap: Map<string, string>;
  selectedFeed: UseArticleListHeaderControllerParams["selectedFeed"];
  effectiveViewMode: ViewMode;
  fetchNextPage?: () => Promise<unknown>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
};

export type ArticleListPresentationLoading = {
  isLoadingFeedArticles: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingFolderArticles: boolean;
  isLoadingRecentArticles: boolean;
  isLoadingTagArticles: boolean;
};

export type ArticleListPresentationSearch = {
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  trimmedDebouncedQuery: string;
  searchResults: unknown[] | undefined;
  isSearching: boolean;
  openSearch: () => void;
  handleToggleSearch: () => void;
  handleCloseSearch: () => void;
  setSearchQuery: (value: string) => void;
};

export type ArticleListPresentationSelectionState = {
  selectedArticleId: string | null;
  recentlyReadIds: Set<string>;
  focusedPane: FocusedPane;
  contentMode: ContentMode;
  layoutMode: UseArticleListHeaderControllerParams["layoutMode"];
  sidebarOpen: boolean;
};

export type ArticleListPresentationPaneActions = {
  selectArticle: (articleId: string) => void;
  clearArticle: () => void;
  closeBrowser: () => void;
  openSidebar: () => void;
  toggleSidebar: () => void;
  setWebPreviewSessionMode: (mode: WebPreviewSessionMode) => void;
  setViewMode: (viewMode: ViewMode) => void;
  onManageSelectedFeed?: (() => void) | null;
};

export type ArticleListPresentationViewPrefs = {
  keyboardPrefs: KeyboardShortcutPrefs;
  scrollToTopOnChange: string;
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
};

export type UseArticleListPresentationParams = {
  translators: ArticleListPresentationTranslators;
  source: ArticleListPresentationSource;
  loading: ArticleListPresentationLoading;
  search: ArticleListPresentationSearch;
  selectionState: ArticleListPresentationSelectionState;
  paneActions: ArticleListPresentationPaneActions;
  viewPrefs: ArticleListPresentationViewPrefs;
};

export type UseArticleListHeaderActionsParams = {
  selection: ArticleListSelection;
  feeds: FeedDto[] | undefined;
  feedId: string | null;
  selectedFeed: FeedDto | undefined;
  filteredArticles: ArticleDto[];
};

export type UseArticleListHeaderActionsResult = {
  handleMarkAllRead: () => void;
  markAllReadDisabled: boolean;
};

export type UseArticleListHeaderControllerParams = {
  selection: ArticleListSelection;
  feeds: FeedDto[] | undefined;
  feedId: string | null;
  selectedFeed: FeedDto | undefined;
  filteredArticles: ArticleDto[];
  layoutMode: LayoutMode;
  sidebarOpen: boolean;
  showSearch: boolean;
  contentMode: ContentMode;
  sidebarSubscriptionsLabel: string;
  showSidebarLabel: string;
  hideSidebarLabel: string;
  openSidebar: () => void;
  toggleSidebar: () => void;
  setWebPreviewSessionMode: (mode: WebPreviewSessionMode) => void;
};

export type UseArticleListHeaderControllerResult = UseArticleListHeaderControlsResult & {
  handleMarkAllRead: () => void;
  markAllReadDisabled: boolean;
};

export type UseArticleListHeaderControlsParams = {
  layoutMode: LayoutMode;
  sidebarOpen: boolean;
  showSearch: boolean;
  contentMode: ContentMode;
  sidebarSubscriptionsLabel: string;
  showSidebarLabel: string;
  hideSidebarLabel: string;
  openSidebar: () => void;
  toggleSidebar: () => void;
  setWebPreviewSessionMode: (mode: WebPreviewSessionMode) => void;
};

export type UseArticleListHeaderControlsResult = {
  showSidebarButton: boolean;
  sidebarButtonLabel: string;
  sidebarButtonText?: string;
  isSidebarVisible?: boolean;
  handleSidebarToggle: () => void;
};

export type UseArticleListSearchParams = {
  selectedAccountId: string | null;
};

export type UseArticleListSearchResult = {
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  trimmedDebouncedQuery: string;
  searchResults: ArticleDto[] | undefined;
  isSearching: boolean;
  openSearch: () => void;
  handleToggleSearch: () => void;
  handleCloseSearch: () => void;
  setSearchQuery: (query: string) => void;
};

export type UseArticleListSourcesParams = {
  selection: ArticleListSelection;
  selectedAccountId: string | null;
  selectedArticleId: string | null;
  retainedArticleIds: Set<string>;
  viewMode: ViewMode;
};

export type UseArticleListSourcesResult = {
  feedId: string | null;
  folderId: string | null;
  tagId: string | null;
  sourcePlan: ReaderSourcePlan;
  accountListScopeId: string | null;
  feeds: FeedDto[] | undefined;
  articles: ArticleDto[] | undefined;
  accountArticles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
  isLoadingFeedArticles: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingFolderArticles: boolean;
  isLoadingRecentArticles: boolean;
  isLoadingTagArticles: boolean;
  fetchNextPage?: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

export type UseArticleListDataParams = {
  feedId: UseArticleListSourcesResult["feedId"];
  folderId: UseArticleListSourcesResult["folderId"];
  tagId: UseArticleListSourcesResult["tagId"];
  sourcePlan: UseArticleListSourcesResult["sourcePlan"];
  accountListScopeId: UseArticleListSourcesResult["accountListScopeId"];
  selectedArticleId: string | null;
  retainedArticleIds: Set<string>;
  feeds: UseArticleListSourcesResult["feeds"];
  articles: UseArticleListSourcesResult["articles"];
  accountArticles: UseArticleListSourcesResult["accountArticles"];
  tagArticles: UseArticleListSourcesResult["tagArticles"];
  searchResults: ArticleDto[] | undefined;
  showSearch: boolean;
  trimmedDebouncedQuery: string;
  sortUnread: string;
  groupBy: string;
};

export type UseArticleListDataResult = {
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
  effectiveViewMode: ViewMode;
  feedNameMap: Map<string, string>;
  filteredArticles: ArticleDto[];
  groupedArticles: Record<string, ArticleDto[]>;
  selectedFeed: FeedDto | undefined;
};
