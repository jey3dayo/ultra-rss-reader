import type { TFunction } from "i18next";
import type { KeyboardEvent, RefObject } from "react";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import type { ArticleListLayoutMode, ArticleListViewMode, UseArticleListViewPropsResult } from "./article-list.types";
import { useArticleListBodyProps } from "./use-article-list-body-props";
import type { UseArticleListHeaderControlsResult } from "./use-article-list-header-controls";
import type { UseArticleListViewStateResult } from "./use-article-list-view-state";

type UseArticleListViewPropsParams = {
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

export function useArticleListViewProps({
  t,
  tc,
  layoutMode,
  showSearch,
  searchQuery,
  searchInputRef,
  showSidebarButton,
  sidebarButtonLabel,
  sidebarButtonText,
  isSidebarVisible,
  feedModeControl,
  handleMarkAllRead,
  handleSidebarToggle,
  handleToggleSearch,
  handleCloseSearch,
  setSearchQuery,
  contextStripContext,
  listRef,
  viewportRef,
  handleListKeyDownCapture,
  isLoading,
  isLoadingAccountArticles,
  isLoadingTagArticles,
  isSearchLoading,
  isSearchEmptyState,
  trimmedDebouncedQuery,
  articleGroups,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  selectArticle,
  effectiveViewMode,
  footerModes,
  setViewMode,
}: UseArticleListViewPropsParams): UseArticleListViewPropsResult {
  const bodyProps = useArticleListBodyProps({
    t,
    tc,
    listRef,
    viewportRef,
    handleListKeyDownCapture,
    isLoading,
    isLoadingAccountArticles,
    isLoadingTagArticles,
    isSearchLoading,
    isSearchEmptyState,
    trimmedDebouncedQuery,
    articleGroups,
    dimArchived,
    textPreview,
    imagePreviews,
    selectionStyle,
    selectArticle,
    handleCloseSearch,
    handleMarkAllRead,
  });

  return {
    layoutMode,
    headerProps: {
      showSearch,
      searchQuery,
      searchInputRef,
      showSidebarButton,
      sidebarButtonLabel,
      sidebarButtonText,
      isSidebarVisible,
      feedModeControl,
      onMarkAllRead: handleMarkAllRead,
      onToggleSidebar: handleSidebarToggle,
      onToggleSearch: handleToggleSearch,
      onCloseSearch: handleCloseSearch,
      onSearchQueryChange: setSearchQuery,
    },
    contextStripProps: {
      primaryLabel: contextStripContext.primaryLabel,
      secondaryLabel: contextStripContext.secondaryLabel,
      tone: contextStripContext.tone,
    },
    bodyProps,
    footerProps: {
      viewMode: effectiveViewMode,
      modes: footerModes,
      onSetViewMode: setViewMode,
    },
  };
}
