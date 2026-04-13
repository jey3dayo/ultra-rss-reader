import type { TFunction } from "i18next";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { FeedDisplayPresetOption } from "@/lib/article-display";
import type { buildKeyToActionMap, KeyboardAction } from "@/lib/keyboard-shortcuts";
import type { UiSelection } from "@/stores/ui-store";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import type { UseArticleListGroupsParams } from "./use-article-list-groups";

export type ArticleListLayoutMode = "wide" | "compact" | "mobile";
export type ArticleListViewMode = "all" | "unread" | "starred";

export type ArticleListHeaderSearchProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchArticlesLabel: string;
  searchArticlesPlaceholder: string;
  onSearchQueryChange: (query: string) => void;
};

export type ArticleListHeaderProps = {
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  showSidebarButton: boolean;
  sidebarButtonLabel: string;
  sidebarButtonText?: string;
  isSidebarVisible?: boolean;
  feedModeControl?: ReactNode;
  onMarkAllRead: () => void;
  onToggleSidebar: () => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onSearchQueryChange: (query: string) => void;
};

export type ArticleListHeaderActionsProps = Pick<
  ArticleListHeaderProps,
  | "showSearch"
  | "showSidebarButton"
  | "sidebarButtonLabel"
  | "sidebarButtonText"
  | "isSidebarVisible"
  | "feedModeControl"
  | "onMarkAllRead"
  | "onToggleSidebar"
  | "onToggleSearch"
  | "onCloseSearch"
> & {
  markAllReadLabel: string;
  searchArticlesLabel: string;
  closeSearchLabel: string;
};

export type ArticleListContextStripProps = {
  primaryLabel?: string | null;
  secondaryLabel?: string | null;
  tone?: "unread" | "starred" | null;
};

export type ArticleListBodyProps = {
  listAriaLabel: string;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  onListKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
  isLoading: boolean;
  loadingMessage: string;
  emptyMessage: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  groups: ArticleGroupsViewGroup[];
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  onSelectArticle: (articleId: string) => void;
  markAllReadLabel: string;
  onMarkAllRead: () => void;
};

export type ArticleListFooterProps = {
  viewMode: ArticleListViewMode;
  modes?: readonly ArticleListViewMode[];
  onSetViewMode: (mode: ArticleListViewMode) => void;
};

export type ArticleListFeedModeControlProps = {
  ariaLabel: string;
  value: FeedDisplayPresetOption;
  options: Array<{ value: FeedDisplayPresetOption; label: string }>;
  onValueChange: (value: FeedDisplayPresetOption) => void;
};

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
  keyboardPrefs: Parameters<typeof buildKeyToActionMap>[0];
};

export type UseArticleListInteractionsResult = {
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  handleListKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export type UseArticleListViewStateParams = {
  selection: UiSelection;
  t: TFunction<"reader">;
  feedId: string | null;
  tagId: string | null;
  accountListScopeId: string | null;
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
  footerModes: ReadonlyArray<"all" | "unread" | "starred">;
  isPrimarySourceLoading: boolean;
  isSearchLoading: boolean;
  isSearchEmptyState: boolean;
};

export type UseArticleListEffectsParams = {
  selection: UiSelection;
  scrollToTopOnChange: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  filteredArticles: ArticleDto[];
  selectedArticleId: string | null;
  isPrimarySourceLoading: boolean;
  clearArticle: () => void;
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
  Pick<UseArticleListViewStateResult, "contextStripContext" | "footerModes" | "isSearchLoading" | "isSearchEmptyState">;

export type UseArticleListPresentationParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  ts: TFunction<"sidebar">;
  selection: UseArticleListViewStateParams["selection"];
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
  selection: UiSelection;
  selectedAccountId: string | null;
};

export type UseArticleListSourcesResult = {
  feedId: string | null;
  folderId: string | null;
  tagId: string | null;
  smartViewKind: "unread" | "starred" | null;
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
  selectArticle: ArticleListBodyProps["onSelectArticle"];
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
  clearArticle: HandleArticleListKeyboardActionParams["clearArticle"];
  toggleSidebar: HandleArticleListKeyboardActionParams["toggleSidebar"];
  openSidebar: HandleArticleListKeyboardActionParams["openSidebar"];
  keyToAction: ReturnType<typeof buildKeyToActionMap>;
};

export type UseArticleListDataParams = {
  selection: UseArticleListSourcesParams["selection"];
  feedId: UseArticleListSourcesResult["feedId"];
  folderId: UseArticleListSourcesResult["folderId"];
  tagId: UseArticleListSourcesResult["tagId"];
  smartViewKind: UseArticleListSourcesResult["smartViewKind"];
  accountListScopeId: UseArticleListSourcesResult["accountListScopeId"];
  viewMode: ArticleListViewMode;
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
