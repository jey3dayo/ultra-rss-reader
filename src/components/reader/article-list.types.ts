import type { TFunction } from "i18next";
import type { ComponentProps, ReactNode, RefObject } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { UiSelection } from "@/stores/ui-store";
import type { ArticleListBody } from "./article-list-body";
import type { ArticleListContextStrip } from "./article-list-context-strip";
import type { ArticleListFooter } from "./article-list-footer";
import type { UseArticleListEffectsParams } from "./use-article-list-effects";
import type { UseArticleListGroupsParams } from "./use-article-list-groups";
import type { UseArticleListHeaderControlsResult } from "./use-article-list-header-controls";
import type { UseArticleListInteractionsParams } from "./use-article-list-interactions";
import type { UseArticleListViewPropsParams } from "./use-article-list-view-props";
import type { UseArticleListViewStateParams } from "./use-article-list-view-state";

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

export type ArticleListContextStripProps = ComponentProps<typeof ArticleListContextStrip>;
export type ArticleListBodyProps = ComponentProps<typeof ArticleListBody>;
export type ArticleListFooterProps = ComponentProps<typeof ArticleListFooter>;

export type UseArticleListViewPropsResult = {
  layoutMode: ArticleListLayoutMode;
  headerProps: ArticleListHeaderProps;
  contextStripProps: ArticleListContextStripProps;
  bodyProps: ArticleListBodyProps;
  footerProps: ArticleListFooterProps;
};

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

export type UseArticleListDataParams = {
  selection: UiSelection;
  feedId: string | null;
  folderId: string | null;
  tagId: string | null;
  smartViewKind: "unread" | "starred" | null;
  accountListScopeId: string | null;
  viewMode: ArticleListViewMode;
  selectedArticleId: string | null;
  retainedArticleIds: Set<string>;
  feeds: FeedDto[] | undefined;
  articles: ArticleDto[] | undefined;
  accountArticles: ArticleDto[] | undefined;
  tagArticles: ArticleDto[] | undefined;
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
