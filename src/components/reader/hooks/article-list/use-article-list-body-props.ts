import type { TFunction } from "i18next";
import type { ArticleListSetupState } from "../../article-list.types";
import type { ArticleListBodyProps } from "../../article-list-body";

type ArticleListBodyEmptyStateProps = Pick<
  ArticleListBodyProps,
  "emptyStateVariant" | "emptyMessage" | "emptyDescription" | "emptyActionLabel" | "onEmptyAction"
>;

type UseArticleListBodyPropsParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
  listRef: ArticleListBodyProps["listRef"];
  viewportRef: ArticleListBodyProps["viewportRef"];
  handleListKeyDownCapture: ArticleListBodyProps["onListKeyDownCapture"];
  isLoading: boolean;
  isLoadingAccountArticles: boolean;
  isLoadingFolderArticles: boolean;
  isLoadingRecentArticles: boolean;
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

type BuildArticleListBodyEmptyStateParams = Pick<
  UseArticleListBodyPropsParams,
  "t" | "isSearchEmptyState" | "setupEmptyState" | "trimmedDebouncedQuery" | "handleCloseSearch"
>;

export function buildArticleListBodyEmptyState({
  t,
  isSearchEmptyState,
  setupEmptyState,
  trimmedDebouncedQuery,
  handleCloseSearch,
}: BuildArticleListBodyEmptyStateParams): ArticleListBodyEmptyStateProps {
  const emptyStateVariant = isSearchEmptyState
    ? "default"
    : setupEmptyState === "no-accounts"
      ? "hidden"
      : setupEmptyState === "none"
        ? "default"
        : "setup";
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
    emptyStateVariant,
    emptyMessage,
    emptyDescription,
    emptyActionLabel: isSearchEmptyState ? t("clear_search_action") : undefined,
    onEmptyAction: isSearchEmptyState ? handleCloseSearch : undefined,
  };
}

export function useArticleListBodyProps({
  t,
  tc,
  listRef,
  viewportRef,
  handleListKeyDownCapture,
  isLoading,
  isLoadingAccountArticles,
  isLoadingFolderArticles,
  isLoadingRecentArticles,
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
}: UseArticleListBodyPropsParams): ArticleListBodyProps {
  const emptyStateProps = buildArticleListBodyEmptyState({
    t,
    isSearchEmptyState,
    setupEmptyState,
    trimmedDebouncedQuery,
    handleCloseSearch,
  });

  return {
    listAriaLabel: t("article_list"),
    listRef,
    viewportRef,
    onListKeyDownCapture: handleListKeyDownCapture,
    isLoading:
      isLoading ||
      isLoadingAccountArticles ||
      isLoadingFolderArticles ||
      isLoadingRecentArticles ||
      isLoadingTagArticles ||
      isSearchLoading,
    loadingMessage: tc("loading"),
    ...emptyStateProps,
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
