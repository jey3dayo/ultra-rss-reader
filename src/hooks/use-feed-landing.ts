import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { listArticles, listFeedStarredArticles, listFeeds } from "@/api/tauri-commands";
import { useFeeds } from "@/hooks/use-feeds";
import { resolveFeedLandingArticleResult, resolveFeedLandingDisplay } from "@/lib/feed/feed-landing";
import { queryKeys } from "@/lib/query/query-invalidation";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export type FeedLandingFailure =
  | { type: "missing_account" }
  | { type: "feed_not_found"; feedId: string }
  | { type: "landing_fetch_failed"; feedId: string; message: string };

export type FeedLandingSuccess = {
  type: "feed_selected";
  feedId: string;
  articleId: string | null;
};
export type FeedLandingResult = Result.Result<FeedLandingSuccess, FeedLandingFailure>;

type FeedLandingUiSnapshot = Pick<
  ReturnType<typeof useUiStore.getState>,
  "browserUrl" | "contentMode" | "focusedPane" | "selectedArticleId" | "selection" | "viewMode"
>;

function captureFeedLandingUiSnapshot(store: ReturnType<typeof useUiStore.getState>): FeedLandingUiSnapshot {
  return {
    browserUrl: store.browserUrl,
    contentMode: store.contentMode,
    focusedPane: store.focusedPane,
    selectedArticleId: store.selectedArticleId,
    selection: store.selection,
    viewMode: store.viewMode,
  };
}

function restoreFeedLandingUiSnapshot(snapshot: FeedLandingUiSnapshot) {
  useUiStore.setState(snapshot);
}

function readErrorMessage(error: unknown): string | null {
  try {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error !== "object" || error === null || !("message" in error)) {
      return null;
    }

    const message = Reflect.get(error, "message");
    return typeof message === "string" ? message : null;
  } catch {
    return null;
  }
}

function getLandingFailureMessage(error: unknown) {
  const message = readErrorMessage(error)
    ?.replace(/^Error:\s*/, "")
    .trim();
  return message && message !== "[object Object]" ? message : "Unknown error";
}

export function useFeedLanding() {
  const queryClient = useQueryClient();
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const prefs = usePreferencesStore((state) => state.prefs);
  const sortUnread = usePreferencesStore(
    (state) => state.prefs.reading_sort ?? state.prefs.sort_unread ?? "newest_first",
  );

  return useCallback(
    async (feedId: string) => {
      if (!selectedAccountId) {
        return Result.fail({
          type: "missing_account",
        } satisfies FeedLandingFailure);
      }

      const store = useUiStore.getState();
      const previousUiState = captureFeedLandingUiSnapshot(store);
      let selectedFeedOptimistically = false;
      try {
        const feedQueryKey = queryKeys.feeds.byAccount(selectedAccountId);
        const feedList =
          feeds.length > 0
            ? feeds
            : await queryClient
                .fetchQuery({
                  queryKey: feedQueryKey,
                  queryFn: () => listFeeds(selectedAccountId).then((result) => Result.unwrap(result)),
                })
                .catch((error) => {
                  const cachedFeeds = queryClient.getQueryData<FeedDto[]>(feedQueryKey);
                  if (cachedFeeds) {
                    return cachedFeeds;
                  }
                  throw error;
                });

        const feed = feedList.find((candidate) => candidate.id === feedId);
        if (!feed) {
          return Result.fail({
            type: "feed_not_found",
            feedId,
          } satisfies FeedLandingFailure);
        }

        const preserveStarredContext =
          store.viewMode === "starred" || (store.selection.type === "smart" && store.selection.kind === "starred");

        store.selectFeedFromCurrentContext(feedId);
        selectedFeedOptimistically = true;

        const articlesQueryKey = queryKeys.articles.byFeed(feedId, preserveStarredContext ? "starred" : "all");
        const articles = await queryClient
          .fetchQuery({
            queryKey: articlesQueryKey,
            queryFn: () =>
              (preserveStarredContext ? listFeedStarredArticles(feedId) : listArticles(feedId)).then((result) =>
                Result.unwrap(result),
              ),
          })
          .catch((error) => {
            const cachedArticles = queryClient.getQueryData<ArticleDto[]>(articlesQueryKey);
            if (cachedArticles) {
              return cachedArticles;
            }
            throw error;
          });

        const landingArticleResult = resolveFeedLandingArticleResult({
          articles,
          sortUnread,
          viewMode: preserveStarredContext ? "starred" : "unread",
        });
        if (Result.isFailure(landingArticleResult)) {
          store.closeBrowser();
          return Result.succeed({
            type: "feed_selected",
            feedId,
            articleId: null,
          } satisfies FeedLandingSuccess);
        }

        const landingArticle = Result.unwrap(landingArticleResult);
        store.selectArticle(landingArticle.id);

        const resolvedDisplay = resolveFeedLandingDisplay({
          feed,
          prefs,
          articleUrl: landingArticle.url,
        });

        const landingArticleUrl = landingArticle.url;
        if (resolvedDisplay.webPreviewMode && landingArticleUrl) {
          store.openBrowser(landingArticleUrl);
        } else {
          store.closeBrowser();
        }
        return Result.succeed({
          type: "feed_selected",
          feedId,
          articleId: landingArticle.id,
        } satisfies FeedLandingSuccess);
      } catch (error) {
        console.error("Failed to land on feed article:", error);
        if (selectedFeedOptimistically) {
          restoreFeedLandingUiSnapshot(previousUiState);
        } else {
          store.closeBrowser();
        }
        return Result.fail({
          type: "landing_fetch_failed",
          feedId,
          message: getLandingFailureMessage(error),
        } satisfies FeedLandingFailure);
      }
    },
    [feeds, prefs, queryClient, selectedAccountId, sortUnread],
  );
}
