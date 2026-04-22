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
  setupEmptyState,
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
  const emptyStateVariant =
    setupEmptyState === "no-accounts" ? "hidden" : setupEmptyState === "none" ? "default" : "setup";
  const emptyMessage = isSearchEmptyState
    ? t("search_no_results_title", { query: trimmedDebouncedQuery })
    : setupEmptyState === "no-accounts"
      ? t("article_list_setup_no_accounts_title")
      : setupEmptyState === "no-feeds"
        ? t("article_list_setup_no_feeds_title")
        : t("no_articles");
  const emptyDescription = isSearchEmptyState
    ? t("search_no_results_description")
    : setupEmptyState === "no-accounts"
      ? t("article_list_setup_no_accounts_description")
      : setupEmptyState === "no-feeds"
        ? t("article_list_setup_no_feeds_description")
        : t("no_articles_description");

  return {
    listAriaLabel: t("article_list"),
    listRef,
    viewportRef,
    onListKeyDownCapture: handleListKeyDownCapture,
    isLoading: isLoading || isLoadingAccountArticles || isLoadingTagArticles || isSearchLoading,
    loadingMessage: tc("loading"),
    emptyStateVariant,
    emptyMessage,
    emptyDescription,
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
