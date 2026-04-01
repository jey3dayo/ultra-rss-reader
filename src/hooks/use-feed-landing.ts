import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { listArticles, listFeeds } from "@/api/tauri-commands";
import { useFeeds } from "@/hooks/use-feeds";
import { resolveFeedLandingArticle, resolveFeedLandingMode } from "@/lib/feed-landing";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function useFeedLanding() {
  const queryClient = useQueryClient();
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const readerView = usePreferencesStore((state) => resolvePreferenceValue(state.prefs, "reader_view"));
  const sortUnread = usePreferencesStore(
    (state) => state.prefs.reading_sort ?? state.prefs.sort_unread ?? "newest_first",
  );

  return useCallback(
    async (feedId: string) => {
      if (!selectedAccountId) {
        return;
      }

      const store = useUiStore.getState();
      const feedList =
        feeds.length > 0
          ? feeds
          : await queryClient.fetchQuery({
              queryKey: ["feeds", selectedAccountId],
              queryFn: () => listFeeds(selectedAccountId).then((result) => Result.unwrap(result)),
            });

      const feed = feedList.find((candidate) => candidate.id === feedId);
      if (!feed) {
        return;
      }

      store.selectFeed(feedId);

      try {
        const articles = await queryClient.fetchQuery({
          queryKey: ["articles", feedId],
          queryFn: () => listArticles(feedId).then((result) => Result.unwrap(result)),
        });

        const landingArticle = resolveFeedLandingArticle({ articles, sortUnread });
        if (!landingArticle) {
          store.closeBrowser();
          return;
        }

        store.selectArticle(landingArticle.id);

        if (
          resolveFeedLandingMode({
            feedDisplayMode: feed.display_mode,
            defaultDisplayMode: readerView,
            articleUrl: landingArticle.url,
          }) === "browser"
        ) {
          store.openBrowser(landingArticle.url as string);
        } else {
          store.closeBrowser();
        }
      } catch (error) {
        console.error("Failed to land on feed article:", error);
        store.closeBrowser();
      }
    },
    [feeds, queryClient, readerView, selectedAccountId, sortUnread],
  );
}
