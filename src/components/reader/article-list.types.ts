import type { TFunction } from "i18next";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { FeedDisplayPresetOption } from "@/lib/articles/article-display";
import type { KeyboardAction, KeyboardShortcutPrefs, KeyToActionMap } from "@/lib/keyboard/keyboard-shortcuts";
import type { ArticleNavigationDirection, FocusedPane, LayoutMode } from "@/lib/layout/layout-state.types";
import type { ReaderSourcePlan } from "@/lib/reader/reader-query";
import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import type { ArticleListBodyProps } from "./article-list-body";
import type { ArticleListContextStripProps } from "./article-list-context-strip";
import type { ArticleListFooterProps } from "./article-list-footer";
import type { ArticleListHeaderProps } from "./article-list-header";

export type ArticleListLayoutMode = LayoutMode;
export type ArticleListSelection = ReaderSelection;
export type ArticleListViewMode = ViewMode;
export type ArticleListSetupState = "none" | "no-accounts" | "no-feeds";

export type UseArticleListViewPropsResult = {
  layoutMode: ArticleListLayoutMode;
  headerProps: ArticleListHeaderProps;
  contextStripProps: ArticleListContextStripProps;
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
};

export type UseArticleListInteractionsResult = {
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  handleListKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export type UseArticleListViewStateParams = {
  selection: ArticleListSelection;
  t: TFunction<"reader">;
  selectedAccountId: string | null;
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
  accountCount?: number;
  feedCount?: number;
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
  showSearch: boolean;
  trimmedDebouncedQuery: string;
  searchResults: unknown[] | undefined;
  isSearching: boolean;
  filteredArticleCount: number;
};

export type UseArticleListViewStateResult = {
  contextStripContext: {
    primaryLabel: string | null;
    secondaryLabel: string | null;
    tone: "unread" | "starred" | null;
  };
  footerModes: ReadonlyArray<ArticleListViewMode>;
  footerDisabledModes: ReadonlyArray<ArticleListViewMode>;
  isPrimarySourceLoading: boolean;
  isSearchLoading: boolean;
  isSearchEmptyState: boolean;
  setupEmptyState: ArticleListSetupState;
};

export type UseArticleListEffectsParams = {
  selection: ArticleListSelection;
  scrollToTopOnChange: string;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  filteredArticles: ArticleDto[];
  focusedPane: FocusedPane;
  selectedArticleId: string | null;
  isPrimarySourceLoading: boolean;
  clearArticle: () => void;
};

export type UseArticleListGroupsParams = {
  groupedArticles: Record<string, ArticleDto[]>;
  groupBy: string;
  feedNameMap: Map<string, string>;
  selectedArticleId: string | null;
  recentlyReadIds: Set<string>;
  t: TFunction<"reader">;
};

export type UseArticleListViewPropsParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  layoutMode: ArticleListLayoutMode;
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
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
  trimmedDebouncedQuery: string;
  articleGroups: ArticleGroupsViewGroup[];
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  selectArticle: (articleId: string) => void;
  effectiveViewMode: ArticleListViewMode;
  setViewMode: (viewMode: ArticleListViewMode) => void;
} & Pick<
  UseArticleListHeaderControlsResult,
  | "showSidebarButton"
  | "sidebarButtonLabel"
  | "sidebarButtonText"
  | "isSidebarVisible"
  | "feedModeControl"
  | "handleSidebarToggle"
> &
  Pick<
    UseArticleListViewStateResult,
    | "contextStripContext"
    | "footerModes"
    | "footerDisabledModes"
    | "isSearchLoading"
    | "isSearchEmptyState"
    | "setupEmptyState"
  >;

export type UseArticleListPresentationParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  ts: TFunction<"sidebar">;
  selection: UseArticleListViewStateParams["selection"];
  focusedPane: FocusedPane;
  selectedAccountId: string | null;
  accountCount?: number;
  feeds: UseArticleListSourcesResult["feeds"];
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
  showSearch: boolean;
  trimmedDebouncedQuery: string;
  searchResults: UseArticleListViewStateParams["searchResults"];
  isSearching: boolean;
  filteredArticles: UseArticleListEffectsParams["filteredArticles"];
  groupedArticles: UseArticleListGroupsParams["groupedArticles"];
  groupBy: UseArticleListGroupsParams["groupBy"];
  feedNameMap: UseArticleListGroupsParams["feedNameMap"];
  selectedArticleId: string | null;
  recentlyReadIds: UseArticleListGroupsParams["recentlyReadIds"];
  selectedFeed: UseArticleListHeaderControllerParams["selectedFeed"];
  layoutMode: UseArticleListHeaderControllerParams["layoutMode"];
  sidebarOpen: boolean;
  openSidebar: () => void;
  toggleSidebar: () => void;
  selectArticle: (articleId: string) => void;
  clearArticle: () => void;
  openSearch: () => void;
  keyboardPrefs: UseArticleListInteractionsParams["keyboardPrefs"];
  scrollToTopOnChange: string;
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  effectiveViewMode: UseArticleListViewPropsParams["effectiveViewMode"];
  setViewMode: UseArticleListViewPropsParams["setViewMode"];
  searchQuery: string;
  searchInputRef: UseArticleListViewPropsParams["searchInputRef"];
  handleToggleSearch: () => void;
  handleCloseSearch: () => void;
  setSearchQuery: (value: string) => void;
};

export type UseArticleListHeaderActionsParams = {
  selection: ArticleListSelection;
  feeds: FeedDto[] | undefined;
  feedId: string | null;
  selectedFeed: FeedDto | undefined;
  filteredArticles: ArticleDto[];
};

export type UseArticleListHeaderActionsResult = {
  selectedFeedDisplayPreset: FeedDisplayPresetOption;
  displayPresetOptions: Array<{ value: FeedDisplayPresetOption; label: string }>;
  handleSetDisplayMode: (nextPreset: FeedDisplayPresetOption) => Promise<void>;
  handleMarkAllRead: () => void;
};

export type UseArticleListHeaderControllerParams = {
  selection: ArticleListSelection;
  feeds: FeedDto[] | undefined;
  feedId: string | null;
  selectedFeed: FeedDto | undefined;
  filteredArticles: ArticleDto[];
  layoutMode: ArticleListLayoutMode;
  sidebarOpen: boolean;
  sidebarSubscriptionsLabel: string;
  feedDisplayLabel: string;
  showSidebarLabel: string;
  hideSidebarLabel: string;
  openSidebar: () => void;
  toggleSidebar: () => void;
};

export type UseArticleListHeaderControllerResult = UseArticleListHeaderControlsResult & {
  handleMarkAllRead: () => void;
};

export type UseArticleListHeaderControlsParams = {
  layoutMode: ArticleListLayoutMode;
  sidebarOpen: boolean;
  sidebarSubscriptionsLabel: string;
  feedDisplayLabel: string;
  showSidebarLabel: string;
  hideSidebarLabel: string;
  resolvedFeedId: string | null;
  selectedFeedDisplayPreset: FeedDisplayPresetOption;
  displayPresetOptions: Array<{ value: FeedDisplayPresetOption; label: string }>;
  onSetDisplayMode: (value: FeedDisplayPresetOption) => void;
  openSidebar: () => void;
  toggleSidebar: () => void;
};

export type UseArticleListHeaderControlsResult = {
  showSidebarButton: boolean;
  sidebarButtonLabel: string;
  sidebarButtonText?: string;
  isSidebarVisible?: boolean;
  feedModeControl: ReactNode;
  handleSidebarToggle: () => void;
};

export type UseArticleListBodyPropsParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  listRef: ArticleListBodyProps["listRef"];
  viewportRef: ArticleListBodyProps["viewportRef"];
  handleListKeyDownCapture: ArticleListBodyProps["onListKeyDownCapture"];
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
  isSearchLoading: boolean;
  isSearchEmptyState: boolean;
  setupEmptyState: ArticleListSetupState;
  trimmedDebouncedQuery: string;
  articleGroups: ArticleListBodyProps["groups"];
  dimArchived: ArticleListBodyProps["dimArchived"];
  textPreview: ArticleListBodyProps["textPreview"];
  imagePreviews: ArticleListBodyProps["imagePreviews"];
  selectionStyle: ArticleListBodyProps["selectionStyle"];
  selectArticle: ArticleListBodyProps["onSelectArticle"];
  handleCloseSearch: () => void;
  handleMarkAllRead: () => void;
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
  viewMode: ArticleListViewMode;
};

export type ArticleListPrimarySourceSnapshot = {
  contextKey: string;
  articles: ArticleDto[] | undefined;
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
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
};

export type UseArticleListNavigationParams = {
  filteredArticles: ArticleDto[];
  selectedArticleId: string | null;
  selectArticle: (articleId: string, options?: { navigationDirection?: ArticleNavigationDirection | null }) => void;
  listRef: ArticleListBodyProps["listRef"];
  viewportRef: ArticleListBodyProps["viewportRef"];
};

export type UseArticleListGlobalEventsParams = {
  onNavigateArticle: (direction: 1 | -1) => void;
  onFocusSearch: UseArticleListSearchResult["openSearch"];
  onMarkAllRead: () => void;
};

export type HandleArticleListKeyboardActionParams = {
  action: KeyboardAction;
  clearArticle: () => void;
  toggleSidebar: () => void;
  openSidebar: () => void;
};

export type UseArticleListKeydownHandlerParams = {
  selectedArticleId: string | null;
  selectArticle: (articleId: string) => void;
  clearArticle: HandleArticleListKeyboardActionParams["clearArticle"];
  toggleSidebar: HandleArticleListKeyboardActionParams["toggleSidebar"];
  openSidebar: HandleArticleListKeyboardActionParams["openSidebar"];
  keyToAction: KeyToActionMap;
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
  effectiveViewMode: ArticleListViewMode;
  feedNameMap: Map<string, string>;
  filteredArticles: ArticleDto[];
  groupedArticles: Record<string, ArticleDto[]>;
  selectedFeed: FeedDto | undefined;
};
