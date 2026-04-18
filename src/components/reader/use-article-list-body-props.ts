import type { UseArticleListBodyPropsParams } from "./article-list.types";
import type { ArticleListBody } from "./article-list-body";

export function useArticleListBodyProps({
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
}: UseArticleListBodyPropsParams): React.ComponentProps<typeof ArticleListBody> {
  return {
    listAriaLabel: t("article_list"),
    listRef,
    viewportRef,
    onListKeyDownCapture: handleListKeyDownCapture,
    isLoading: isLoading || isLoadingAccountArticles || isLoadingTagArticles || isSearchLoading,
    loadingMessage: tc("loading"),
    emptyMessage: isSearchEmptyState
      ? t("search_no_results_title", { query: trimmedDebouncedQuery })
      : t("no_articles"),
    emptyDescription: isSearchEmptyState ? t("search_no_results_description") : t("no_articles_description"),
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
  };
}
