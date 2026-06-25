import type { TFunction } from "i18next";
import type { ArticleListBodyProps } from "../../article-list-body";

export type ArticleListFailureState = "permission" | "auth" | "network" | "schema";
export type ArticleListSetupState = "none" | "no-accounts" | "no-feeds" | ArticleListFailureState;

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
  isLoadingFeedArticles: boolean;
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
  onManageSelectedFeed?: (() => void) | null;
  handleCloseSearch: () => void;
  handleMarkAllRead: () => void;
};

type BuildArticleListBodyEmptyStateParams = Pick<
  UseArticleListBodyPropsParams,
  "t" | "isSearchEmptyState" | "setupEmptyState" | "trimmedDebouncedQuery" | "handleCloseSearch"
> & {
  onManageSelectedFeed?: (() => void) | null;
};

const ARTICLE_LIST_FAILURE_EMPTY_STATES = {
  permission: {
    emptyMessage: "Permission required",
    emptyDescription: "The article list is unavailable until access is restored.",
  },
  auth: {
    emptyMessage: "Authentication required",
    emptyDescription: "Reconnect the account before treating this list as empty.",
  },
  network: {
    emptyMessage: "Cannot refresh articles",
    emptyDescription: "Check the connection or retry before assuming there are no articles.",
  },
  schema: {
    emptyMessage: "Article data needs recovery",
    emptyDescription: "The response could not be read. Open logs or contact support.",
  },
} as const satisfies Record<
  ArticleListFailureState,
  Pick<ArticleListBodyEmptyStateProps, "emptyMessage" | "emptyDescription">
>;

function isArticleListFailureState(setupEmptyState: ArticleListSetupState): setupEmptyState is ArticleListFailureState {
  return setupEmptyState in ARTICLE_LIST_FAILURE_EMPTY_STATES;
}

export function buildArticleListBodyEmptyState({
  t,
  isSearchEmptyState,
  setupEmptyState,
  trimmedDebouncedQuery,
  handleCloseSearch,
  onManageSelectedFeed = null,
}: BuildArticleListBodyEmptyStateParams): ArticleListBodyEmptyStateProps {
  const emptyStateVariant = isSearchEmptyState
    ? "default"
    : setupEmptyState === "no-accounts"
      ? "hidden"
      : isArticleListFailureState(setupEmptyState)
        ? "setup"
        : setupEmptyState === "none"
          ? "default"
          : "setup";
  const emptyMessage = isSearchEmptyState
    ? t("search_no_results_title", { query: trimmedDebouncedQuery })
    : setupEmptyState === "no-accounts"
      ? t("article_list_setup_no_accounts_title")
      : isArticleListFailureState(setupEmptyState)
        ? ARTICLE_LIST_FAILURE_EMPTY_STATES[setupEmptyState].emptyMessage
        : setupEmptyState === "no-feeds"
          ? t("article_list_setup_no_feeds_title")
          : t("no_articles");
  const emptyDescription = isSearchEmptyState
    ? t("search_no_results_description")
    : setupEmptyState === "no-accounts"
      ? t("article_list_setup_no_accounts_description")
      : isArticleListFailureState(setupEmptyState)
        ? ARTICLE_LIST_FAILURE_EMPTY_STATES[setupEmptyState].emptyDescription
        : setupEmptyState === "no-feeds"
          ? t("article_list_setup_no_feeds_description")
          : t("no_articles_description");

  return {
    emptyStateVariant,
    emptyMessage,
    emptyDescription,
    emptyActionLabel: isSearchEmptyState
      ? t("clear_search_action")
      : setupEmptyState === "none" && onManageSelectedFeed
        ? t("manage_subscription")
        : undefined,
    onEmptyAction: isSearchEmptyState
      ? handleCloseSearch
      : setupEmptyState === "none"
        ? (onManageSelectedFeed ?? undefined)
        : undefined,
  };
}

export function useArticleListBodyProps({
  t,
  tc,
  listRef,
  viewportRef,
  handleListKeyDownCapture,
  isLoadingFeedArticles,
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
  onManageSelectedFeed = null,
  handleCloseSearch,
  handleMarkAllRead,
}: UseArticleListBodyPropsParams): ArticleListBodyProps {
  const emptyStateProps = buildArticleListBodyEmptyState({
    t,
    isSearchEmptyState,
    setupEmptyState,
    trimmedDebouncedQuery,
    handleCloseSearch,
    onManageSelectedFeed,
  });

  return {
    listAriaLabel: t("article_list"),
    listRef,
    viewportRef,
    onListKeyDownCapture: handleListKeyDownCapture,
    isLoading:
      isLoadingFeedArticles ||
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
    manageSelectedFeedLabel: onManageSelectedFeed ? t("edit_feed_ellipsis") : undefined,
    onManageSelectedFeed: onManageSelectedFeed ?? undefined,
  };
}
