import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { DevScenario, DevScenarioContext, DevScenarioId } from "@/dev/scenarios/types";
import { resolveFeedDisplayOverrides } from "@/lib/article-display";

const DEFAULT_FEED_HINTS = ["マガポケ", "ジャンプ+", "comic", "manga", "少年ジャンプ", "ゴリミー"];

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
  if (typeof window === "undefined") {
    return fallbackUrl;
  }

  return new URL("/dev-image-viewer.html", window.location.origin).toString();
}

function scoreFeed(feed: FeedDto): number {
  const normalized = [feed.title, feed.url, feed.site_url].filter(Boolean).join(" ").toLowerCase();
  const hintScore = DEFAULT_FEED_HINTS.reduce((score, hint, index) => {
    return normalized.includes(hint.toLowerCase()) ? score + (DEFAULT_FEED_HINTS.length - index) * 100 : score;
  }, 0);

  const unreadScore = Math.min(feed.unread_count, 100);
  const displayOverrides = resolveFeedDisplayOverrides(feed);
  const displayModeScore = displayOverrides.readerMode === "on" && displayOverrides.webPreviewMode === "on" ? 500 : 0;
  return displayModeScore + hintScore + unreadScore;
}

export function pickImageViewerOverlayFeed(feeds: FeedDto[]): FeedDto | null {
  if (feeds.length === 0) {
    return null;
  }

  return rankImageViewerOverlayFeeds(feeds)[0] ?? null;
}

export function rankImageViewerOverlayFeeds(feeds: FeedDto[]): FeedDto[] {
  return [...feeds].sort((left, right) => scoreFeed(right) - scoreFeed(left));
}

function scoreArticle(article: ArticleDto): number {
  const urlScore = article.url ? 1000 : 0;
  const unreadScore = article.is_read ? 0 : 100;
  const thumbnailScore = article.thumbnail ? 25 : 0;
  return urlScore + unreadScore + thumbnailScore;
}

export function pickImageViewerOverlayArticle(articles: ArticleDto[]): ArticleDto | null {
  if (articles.length === 0) {
    return null;
  }

  return [...articles].sort((left, right) => scoreArticle(right) - scoreArticle(left))[0] ?? null;
}
