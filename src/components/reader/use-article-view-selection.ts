import { Result } from "@praha/byethrow";
import type { ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import { useAccounts } from "@/hooks/use-accounts";
import { useArticles } from "@/hooks/use-articles";
import { useFolders } from "@/hooks/use-folders";
import { useTags } from "@/hooks/use-tags";
import { findLatestArticle, findSelectedArticle } from "@/lib/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { getPrimarySourceContext } from "./article-selection-context";
import { useArticleListData } from "./use-article-list-data";
import { useArticleListSources } from "./use-article-list-sources";

export type ArticleViewSummaryState =
  | {
      kind: "feed";
      feed: FeedDto;
      latestArticleTitle?: string | null;
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "folder";
      folder: FolderDto;
      feedCount: number;
      unreadCount: number;
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "tag";
      tag: TagDto;
      articleCount: number;
      feedCount: number;
      latestArticlePublishedAt?: string | null;
    }
  | {
      kind: "smart";
      smartKind: "unread" | "starred";
      articleCount: number;
      feedCount: number;
      latestArticlePublishedAt?: string | null;
    };

type ArticleViewEmptyState = {
  kind: "empty";
  emptyReason: "default" | "no-accounts" | "no-feeds";
  summary?: ArticleViewSummaryState;
};

export type ArticleViewSelectionState =
  | { kind: "subscriptions-index" }
  | { kind: "feed-cleanup" }
  | { kind: "browser-only"; browserUrl: string }
  | ArticleViewEmptyState
  | { kind: "not-found" }
  | { kind: "article"; article: ArticleDto; feed?: FeedDto };

export function useArticleViewSelection(): ArticleViewSelectionState {
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const subscriptionsWorkspace = useUiStore((s) => s.subscriptionsWorkspace);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const retainedArticleIds = useUiStore((s) => s.retainedArticleIds);
  const viewMode = useUiStore((s) => s.viewMode);
  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;
  const { data: accounts } = useAccounts();
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: allFeedArticles } = useArticles(selectedFeedId);
  const sortUnread = usePreferencesStore((s) => s.prefs.reading_sort ?? s.prefs.sort_unread ?? "newest_first");
  const groupBy = usePreferencesStore((s) => s.prefs.group_by ?? "date");
  const selectionContext = getPrimarySourceContext(selection, selectedAccountId);
  const sources = useArticleListSources({
    selection,
    selectionContext,
    selectedAccountId,
    selectedArticleId,
    retainedArticleIds,
    viewMode,
  });
  const data = useArticleListData({
    selection,
    feedId: sources.feedId,
    folderId: sources.folderId,
    tagId: sources.tagId,
    smartViewKind: sources.smartViewKind,
    accountListScopeId: sources.accountListScopeId,
    viewMode,
    selectedArticleId,
    retainedArticleIds,
    feeds: sources.feeds,
    articles: sources.articles,
    accountArticles: sources.accountArticles,
    tagArticles: sources.tagArticles,
    searchResults: undefined,
    showSearch: false,
    trimmedDebouncedQuery: "",
    sortUnread,
    groupBy,
  });

  if (subscriptionsWorkspace?.kind === "index") {
    return { kind: "subscriptions-index" };
  }

  if (subscriptionsWorkspace?.kind === "cleanup") {
    return { kind: "feed-cleanup" };
  }

  if (contentMode === "browser" && browserUrl && !selectedArticleId) {
    return { kind: "browser-only", browserUrl };
  }

  if (contentMode === "empty" || !selectedArticleId) {
    if (accounts?.length === 0) {
      return { kind: "empty", emptyReason: "no-accounts" };
    }

    if (selectedAccountId !== null && sources.feeds !== undefined && sources.feeds.length === 0) {
      return { kind: "empty", emptyReason: "no-feeds" };
    }

    const visibleFeedIds = new Set(data.filteredArticles.map((article) => article.feed_id));
    const latestVisibleArticle = findLatestArticle(data.filteredArticles);
    const summary =
      selection.type === "feed"
        ? (() => {
            const feed = selectedFeedId
              ? sources.feeds?.find((candidate) => candidate.id === selectedFeedId)
              : undefined;
            const latestFeedArticle = findLatestArticle(allFeedArticles);

            return feed
              ? {
                  kind: "feed" as const,
                  feed,
                  latestArticleTitle: latestFeedArticle?.title ?? null,
                  latestArticlePublishedAt: latestFeedArticle?.published_at ?? null,
                }
              : undefined;
          })()
        : selection.type === "folder"
          ? (() => {
              const folder = folders?.find((candidate) => candidate.id === selection.folderId);
              if (!folder) {
                return undefined;
              }

              return {
                kind: "folder" as const,
                folder,
                feedCount: (sources.feeds ?? []).filter((feed) => feed.folder_id === folder.id).length,
                unreadCount: data.filteredArticles.filter((article) => !article.is_read).length,
                latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
              };
            })()
          : selection.type === "tag"
            ? (() => {
                const tag = tags?.find((candidate) => candidate.id === selection.tagId);
                if (!tag) {
                  return undefined;
                }

                return {
                  kind: "tag" as const,
                  tag,
                  articleCount: data.filteredArticles.length,
                  feedCount: visibleFeedIds.size,
                  latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
                };
              })()
            : selection.type === "smart"
              ? {
                  kind: "smart" as const,
                  smartKind: selection.kind,
                  articleCount: data.filteredArticles.length,
                  feedCount: visibleFeedIds.size,
                  latestArticlePublishedAt: latestVisibleArticle?.published_at ?? null,
                }
              : undefined;

    return {
      kind: "empty",
      emptyReason: "default",
      summary,
    };
  }

  const articleResult = findSelectedArticle({
    selectedArticleId,
    feedId: data.feedId,
    tagId: data.tagId,
    articles: data.filteredArticles,
    accountArticles: data.filteredArticles,
    tagArticles: data.filteredArticles,
  });

  if (Result.isFailure(articleResult)) {
    if (contentMode === "browser" && browserUrl) {
      return { kind: "browser-only", browserUrl };
    }
    return { kind: "not-found" };
  }

  const article = Result.unwrap(articleResult);
  const feed = sources.feeds?.find((candidate) => candidate.id === article.feed_id);

  return { kind: "article", article, feed };
}
