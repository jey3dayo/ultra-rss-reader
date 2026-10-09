import type { TFunction } from "i18next";
import type { ArticleListBodyProps } from "../../article-list-body";

type ArticleListFailureState = "permission" | "auth" | "network" | "schema";
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
  isLoadingArticles: boolean;
  isSearchLoading: boolean;
  isSearchEmptyState: boolean;
  setupEmptyState: ArticleListSetupState;
  trimmedDebouncedQuery: string;
  contentMotionKey: ArticleListBodyProps["contentMotionKey"];
  articleGroups: ArticleListBodyProps["groups"];
  isActivePane: ArticleListBodyProps["isActivePane"];
  feeds: ArticleListBodyProps["feeds"];
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

type ArticleListBodyEmptyStateKind = "search" | ArticleListSetupState;

function resolveArticleListBodyEmptyStateKind(
  isSearchEmptyState: boolean,
  setupEmptyState: ArticleListSetupState,
): ArticleListBodyEmptyStateKind {
  return isSearchEmptyState ? "search" : setupEmptyState;
}

export function buildArticleListBodyEmptyState({
  t,
  isSearchEmptyState,
  setupEmptyState,
  trimmedDebouncedQuery,
  handleCloseSearch,
  onManageSelectedFeed = null,
}: BuildArticleListBodyEmptyStateParams): ArticleListBodyEmptyStateProps {
  const kind = resolveArticleListBodyEmptyStateKind(isSearchEmptyState, setupEmptyState);

  switch (kind) {
    case "search":
      return {
        emptyStateVariant: "default",
        emptyMessage: t("search_no_results_title", { query: trimmedDebouncedQuery }),
        emptyDescription: t("search_no_results_description"),
        emptyActionLabel: t("clear_search_action"),
        onEmptyAction: handleCloseSearch,
      };
    case "no-accounts":
      return {
        emptyStateVariant: "hidden",
        emptyMessage: t("article_list_setup_no_accounts_title"),
        emptyDescription: t("article_list_setup_no_accounts_description"),
        emptyActionLabel: undefined,
        onEmptyAction: undefined,
      };
    case "no-feeds":
      return {
        emptyStateVariant: "setup",
        emptyMessage: t("article_list_setup_no_feeds_title"),
        emptyDescription: t("article_list_setup_no_feeds_description"),
        emptyActionLabel: undefined,
        onEmptyAction: undefined,
      };
    case "none":
      return {
        emptyStateVariant: "default",
        emptyMessage: t("no_articles"),
        emptyDescription: t("no_articles_description"),
        emptyActionLabel: onManageSelectedFeed ? t("manage_subscription") : undefined,
        onEmptyAction: onManageSelectedFeed ?? undefined,
      };
    case "permission":
    case "auth":
    case "network":
    case "schema":
      return {
        emptyStateVariant: "setup",
        ...ARTICLE_LIST_FAILURE_EMPTY_STATES[kind],
        emptyActionLabel: undefined,
        onEmptyAction: undefined,
      };
  }
}

export function useArticleListBodyProps({
  t,
  tc,
  listRef,
  viewportRef,
  handleListKeyDownCapture,
  isLoadingArticles,
  isSearchLoading,
  isSearchEmptyState,
  setupEmptyState,
  trimmedDebouncedQuery,
  contentMotionKey,
  articleGroups,
  isActivePane,
  feeds,
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
    isLoading: isLoadingArticles || isSearchLoading,
    loadingMessage: tc("loading"),
    ...emptyStateProps,
    groups: articleGroups,
    isActivePane,
    feeds,
    contentMotionKey,
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
