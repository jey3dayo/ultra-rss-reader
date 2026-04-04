import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { DevScenario, DevScenarioContext, DevScenarioId } from "@/dev/scenarios/types";
import {
  pickImageViewerOverlayArticle as pickImageViewerOverlayArticleForRuntime,
  rankImageViewerOverlayFeeds as rankImageViewerOverlayFeedsForRuntime,
  resolveImageViewerOverlayBrowserUrl as resolveImageViewerOverlayBrowserUrlForRuntime,
} from "@/lib/dev-image-viewer-overlay";

export function createUnsupportedDevScenarioRunner(id: DevScenarioId): DevScenario["run"] {
  return ({ ui }) => {
    ui.showToast(`Dev scenario "${id}" is not implemented yet.`);
  };
}

export async function runImageViewerOverlayScenario(ctx: DevScenarioContext): Promise<void> {
  try {
    const accounts = await Promise.resolve(ctx.actions.listAccounts());
    ctx.queryClient.setQueryData(["accounts"], accounts);

    if (accounts.length === 0) {
      ctx.ui.showToast("Dev intent could not find any accounts.");
      return;
    }

    let selectedAccount = null;
    let selectedFeed = null;
    let selectedArticles = null;

    for (const account of accounts) {
      const feeds = await Promise.resolve(ctx.actions.listFeeds(account.id));
      ctx.queryClient.setQueryData(["feeds", account.id], feeds);

      for (const candidateFeed of rankImageViewerOverlayFeeds(feeds)) {
        const candidateArticles = await Promise.resolve(ctx.actions.listArticles(candidateFeed.id));
        ctx.queryClient.setQueryData(["articles", candidateFeed.id], candidateArticles);
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

    if (!selectedAccount || !selectedFeed || !selectedArticles) {
      ctx.ui.showToast("Dev intent could not find any articles.");
      return;
    }

    const article = pickImageViewerOverlayArticle(selectedArticles);
    if (!article) {
      ctx.ui.showToast("Dev intent could not find any articles.");
      return;
    }

    const applyViewerState = () => {
      ctx.queryClient.setQueryData<FeedDto[]>(["feeds", selectedAccount.id], (currentFeeds) =>
        currentFeeds?.map((feed) =>
          feed.id === selectedFeed.id ? { ...feed, reader_mode: "on" as const, web_preview_mode: "on" as const } : feed,
        ),
      );
      ctx.ui.selectAccount(selectedAccount.id);
      ctx.ui.selectFeed(selectedFeed.id);
      ctx.ui.setViewMode("all");
      ctx.ui.selectArticle(article.id);
      const browserUrl = resolveImageViewerOverlayBrowserUrl(article.url);
      if (browserUrl) {
        ctx.ui.openBrowser(browserUrl);
      }
    };

    applyViewerState();
    window.setTimeout(applyViewerState, 300);
    window.setTimeout(applyViewerState, 1200);
  } catch (error) {
    console.error("Failed to hydrate dev intent:", error);
    ctx.ui.showToast("Dev intent failed to open the overlay.");
  }
}

export function resolveImageViewerOverlayBrowserUrl(fallbackUrl: string | null): string | null {
  return resolveImageViewerOverlayBrowserUrlForRuntime(fallbackUrl);
}

export function pickImageViewerOverlayFeed(feeds: FeedDto[]): FeedDto | null {
  const scoredFeeds = rankImageViewerOverlayFeedsForRuntime(feeds);
  return scoredFeeds[0] ?? null;
}

export function rankImageViewerOverlayFeeds(feeds: FeedDto[]): FeedDto[] {
  return rankImageViewerOverlayFeedsForRuntime(feeds);
}

export function pickImageViewerOverlayArticle(articles: ArticleDto[]): ArticleDto | null {
  return pickImageViewerOverlayArticleForRuntime(articles);
}
