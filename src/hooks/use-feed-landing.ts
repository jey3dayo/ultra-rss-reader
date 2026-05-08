import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { listArticles, listFeedStarredArticles, listFeeds } from "@/api/tauri-commands";
import { useFeeds } from "@/hooks/use-feeds";
import { resolveFeedLandingArticleResult, resolveFeedLandingDisplay } from "@/lib/feed/feed-landing";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

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
        return;
      }

      const store = useUiStore.getState();
      const feedQueryKey = ["feeds", selectedAccountId] as const;
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
        return;
      }

      const preserveStarredContext =
        store.viewMode === "starred" || (store.selection.type === "smart" && store.selection.kind === "starred");

      store.selectFeedFromCurrentContext(feedId);

      try {
        const articlesQueryKey = ["articles", feedId, { mode: preserveStarredContext ? "starred" : "all" }] as const;
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
          return;
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
      } catch (error) {
        console.error("Failed to land on feed article:", error);
        store.closeBrowser();
      }
    },
    [feeds, prefs, queryClient, selectedAccountId, sortUnread],
  );
}
