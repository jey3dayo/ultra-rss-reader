import type { TFunction } from "i18next";
import type { KeyboardEvent, RefObject } from "react";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import type { ArticleListBody } from "./article-list-body";

type UseArticleListBodyPropsParams = {
  t: TFunction<"reader">;
  tc: TFunction<"common">;
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
  handleCloseSearch: () => void;
  handleMarkAllRead: () => void;
};

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
  };
}
