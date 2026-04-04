import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { listAccounts, listArticles, listFeeds } from "@/api/tauri-commands";
import {
  consumeLegacyOverlayDevIntent,
  isLegacyOverlayDevIntent,
  pickDevIntentArticle,
  rankDevIntentFeeds,
  readDevIntent,
  resolveDevIntentBrowserUrl,
} from "@/lib/dev-intent";
import { queryClient } from "@/lib/query-client";
import { useUiStore } from "@/stores/ui-store";

export function useDevIntent() {
  useEffect(() => {
    const intent = readDevIntent();
    if (!intent) {
      return;
    }

    if (!isLegacyOverlayDevIntent(intent)) {
      useUiStore.getState().showToast(`Dev scenario "${intent}" is not implemented in the legacy path yet.`);
      return;
    }

    const legacyIntent = consumeLegacyOverlayDevIntent(intent);
    if (!legacyIntent) {
      return;
    }

    void (async () => {
      try {
        const accounts = await listAccounts().then(Result.unwrap());
        queryClient.setQueryData(["accounts"], accounts);

        if (accounts.length === 0) {
          useUiStore.getState().showToast("Dev intent could not find any accounts.");
          return;
        }

        let selectedAccount = null;
        let selectedFeed = null;
        let selectedArticles = null;

        for (const account of accounts) {
          const feeds = await listFeeds(account.id).then(Result.unwrap());
          queryClient.setQueryData(["feeds", account.id], feeds);

          for (const candidateFeed of rankDevIntentFeeds(feeds)) {
            const candidateArticles = await listArticles(candidateFeed.id).then(Result.unwrap());
            queryClient.setQueryData(["articles", candidateFeed.id], candidateArticles);
            if (candidateArticles.length > 0) {
              selectedAccount = account;
              selectedFeed = candidateFeed;
              selectedArticles = candidateArticles;
              break;
            }
          }

          if (selectedAccount && selectedFeed && selectedArticles) {
            break;
          }
        }

        const ui = useUiStore.getState();
        if (!selectedAccount || !selectedFeed || !selectedArticles) {
          ui.showToast("Dev intent could not find any articles.");
          return;
        }

        const article = pickDevIntentArticle(selectedArticles);
        if (!article) {
          ui.showToast("Dev intent could not find any articles.");
          return;
        }

        const applyViewerState = () => {
          const nextUi = useUiStore.getState();
          queryClient.setQueryData<FeedDto[]>(["feeds", selectedAccount.id], (currentFeeds) =>
            currentFeeds?.map((feed) =>
              feed.id === selectedFeed.id
                ? { ...feed, reader_mode: "on" as const, web_preview_mode: "on" as const }
                : feed,
            ),
          );
          nextUi.selectAccount(selectedAccount.id);
          nextUi.selectFeed(selectedFeed.id);
          nextUi.setViewMode("all");
          nextUi.selectArticle(article.id);
          const browserUrl = resolveDevIntentBrowserUrl(legacyIntent, article.url);
          if (browserUrl) {
            nextUi.openBrowser(browserUrl);
          }
        };

        applyViewerState();
        window.setTimeout(applyViewerState, 300);
        window.setTimeout(applyViewerState, 1200);
      } catch (error) {
        console.error("Failed to hydrate dev intent:", error);
        useUiStore.getState().showToast("Dev intent failed to open the overlay.");
      }
    })();
  }, []);
}
