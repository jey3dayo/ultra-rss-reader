import type { TFunction } from "i18next";
import type { ComponentProps, KeyboardEvent, ReactNode, RefObject } from "react";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import type { ArticleListBody } from "./article-list-body";
import type { ArticleListContextStrip } from "./article-list-context-strip";
import type { ArticleListFooter } from "./article-list-footer";
import type { ArticleListHeader } from "./article-list-header";

type LayoutMode = "wide" | "compact" | "mobile";
type ViewMode = "all" | "unread" | "starred";
type HeaderProps = ComponentProps<typeof ArticleListHeader>;
type ContextStripProps = ComponentProps<typeof ArticleListContextStrip>;
type BodyProps = ComponentProps<typeof ArticleListBody>;
type FooterProps = ComponentProps<typeof ArticleListFooter>;

type UseArticleListViewPropsParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  layoutMode: LayoutMode;
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  showSidebarButton: boolean;
  sidebarButtonLabel: string;
  sidebarButtonText?: string;
  isSidebarVisible?: boolean;
  feedModeControl: ReactNode;
  handleMarkAllRead: () => void;
  handleSidebarToggle: () => void;
  handleToggleSearch: () => void;
  handleCloseSearch: () => void;
  setSearchQuery: (value: string) => void;
  contextStripContext: {
    primaryLabel: string | null;
    secondaryLabel: string | null;
    tone: "unread" | "starred" | null;
  };
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  handleListKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingTagArticles: boolean;
  isSearchLoading: boolean;
  isSearchEmptyState: boolean;
  trimmedDebouncedQuery: string;
  articleGroups: ArticleGroupsViewGroup[];
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  selectArticle: (articleId: string) => void;
  effectiveViewMode: ViewMode;
  footerModes: ReadonlyArray<ViewMode>;
  setViewMode: (viewMode: ViewMode) => void;
};

export type UseArticleListViewPropsResult = {
  layoutMode: LayoutMode;
  headerProps: HeaderProps;
  contextStripProps: ContextStripProps;
  bodyProps: BodyProps;
  footerProps: FooterProps;
};

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
    bodyProps: {
      listAriaLabel: t("article_list"),
      listRef,
      viewportRef,
      onListKeyDownCapture: handleListKeyDownCapture,
      isLoading: isLoading || isLoadingAccountArticles || isLoadingTagArticles || isSearchLoading,
      loadingMessage: tc("loading"),
      emptyMessage: isSearchEmptyState
        ? t("search_no_results_title", { query: trimmedDebouncedQuery })
        : t("no_articles"),
      emptyDescription: isSearchEmptyState ? t("search_no_results_description") : undefined,
      emptyActionLabel: isSearchEmptyState ? t("clear_search_action") : undefined,
      onEmptyAction: isSearchEmptyState ? handleCloseSearch : undefined,
      groups: articleGroups,
      dimArchived,
      textPreview,
      imagePreviews,
      selectionStyle,
      onSelectArticle: selectArticle,
      markAllReadLabel: t("mark_all_as_read"),
      onMarkAllRead: handleMarkAllRead,
    },
    footerProps: {
      viewMode: effectiveViewMode,
      modes: footerModes,
      onSetViewMode: setViewMode,
    },
  };
}
