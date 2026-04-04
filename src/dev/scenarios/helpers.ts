import type { AccountDto, ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { DevScenario, DevScenarioContext, DevScenarioId } from "@/dev/scenarios/types";
import {
  pickImageViewerOverlayArticle as pickImageViewerOverlayArticleForRuntime,
  rankImageViewerOverlayFeeds as rankImageViewerOverlayFeedsForRuntime,
  resolveImageViewerOverlayBrowserUrl as resolveImageViewerOverlayBrowserUrlForRuntime,
} from "@/lib/dev-image-viewer-overlay";

const DEV_TAG: TagDto = {
  id: "tag-dev",
  name: "Dev Tag",
  color: null,
};

type RankedFeedSelection = {
  account: AccountDto;
  feed: FeedDto;
  articles: ArticleDto[];
};

export function createUnsupportedDevScenarioRunner(id: DevScenarioId): DevScenario["run"] {
  return ({ ui }) => {
    ui.showToast(`Dev scenario "${id}" is not implemented yet.`);
  };
}

async function cacheAccounts(ctx: DevScenarioContext): Promise<AccountDto[]> {
  const accounts = await Promise.resolve(ctx.actions.listAccounts());
  ctx.queryClient.setQueryData(["accounts"], accounts);
  return accounts;
}

async function findRankedFeedSelection(
  ctx: DevScenarioContext,
  accounts: readonly AccountDto[],
): Promise<RankedFeedSelection | null> {
  for (const account of accounts) {
    const feeds = await Promise.resolve(ctx.actions.listFeeds(account.id));
    ctx.queryClient.setQueryData(["feeds", account.id], feeds);

    for (const candidateFeed of rankImageViewerOverlayFeeds(feeds)) {
      const candidateArticles = await Promise.resolve(ctx.actions.listArticles(candidateFeed.id));
      ctx.queryClient.setQueryData(["articles", candidateFeed.id], candidateArticles);
      if (candidateArticles.length > 0) {
        return {
          account,
          feed: candidateFeed,
          articles: candidateArticles,
        };
      }
    }
  }

  return null;
}

function updateFeedDisplayModes(
  ctx: DevScenarioContext,
  accountId: string,
  feedId: string,
  readerMode: FeedDto["reader_mode"],
  webPreviewMode: FeedDto["web_preview_mode"],
): void {
  ctx.queryClient.setQueryData<FeedDto[]>(["feeds", accountId], (currentFeeds) =>
    currentFeeds?.map((feed) =>
      feed.id === feedId ? { ...feed, reader_mode: readerMode, web_preview_mode: webPreviewMode } : feed,
    ),
  );
}

function selectFeedArticle(
  ctx: DevScenarioContext,
  accountId: string,
  feedId: string,
  articleId: string,
  readerMode: FeedDto["reader_mode"],
  webPreviewMode: FeedDto["web_preview_mode"],
): void {
  updateFeedDisplayModes(ctx, accountId, feedId, readerMode, webPreviewMode);
  ctx.ui.selectAccount(accountId);
  ctx.ui.selectFeed(feedId);
  ctx.ui.setViewMode("all");
  ctx.ui.selectArticle(articleId);
}

export async function runImageViewerOverlayScenario(ctx: DevScenarioContext): Promise<void> {
  try {
    const accounts = await cacheAccounts(ctx);
    if (accounts.length === 0) {
      ctx.ui.showToast("Dev intent could not find any accounts.");
      return;
    }

    const selection = await findRankedFeedSelection(ctx, accounts);
    if (!selection) {
      ctx.ui.showToast("Dev intent could not find any articles.");
      return;
    }

    const article = pickImageViewerOverlayArticle(selection.articles);
    if (!article) {
      ctx.ui.showToast("Dev intent could not find any articles.");
      return;
    }

    const applyViewerState = () => {
      selectFeedArticle(ctx, selection.account.id, selection.feed.id, article.id, "on", "on");
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

export async function runOpenFeedFirstArticleScenario(ctx: DevScenarioContext): Promise<void> {
  try {
    const accounts = await cacheAccounts(ctx);
    if (accounts.length === 0) {
      ctx.ui.showToast('Dev scenario "open-feed-first-article" could not find any accounts.');
      return;
    }

    const selection = await findRankedFeedSelection(ctx, accounts);
    if (!selection) {
      ctx.ui.showToast('Dev scenario "open-feed-first-article" could not find any articles.');
      return;
    }

    const article = pickImageViewerOverlayArticle(selection.articles);
    if (!article) {
      ctx.ui.showToast('Dev scenario "open-feed-first-article" could not find any articles.');
      return;
    }

    selectFeedArticle(ctx, selection.account.id, selection.feed.id, article.id, "on", "off");
  } catch (error) {
    console.error('Failed to run dev scenario "open-feed-first-article":', error);
    ctx.ui.showToast('Dev scenario "open-feed-first-article" failed to open a feed article.');
  }
}

export async function runOpenTagViewScenario(ctx: DevScenarioContext): Promise<void> {
  try {
    const accounts = await cacheAccounts(ctx);
    if (accounts.length === 0) {
      ctx.ui.showToast('Dev scenario "open-tag-view" could not find any accounts.');
      return;
    }

    ctx.queryClient.setQueryData<TagDto[]>(["tags"], (currentTags) => {
      const tags = currentTags ?? [];
      return tags.some((tag) => tag.id === DEV_TAG.id) ? tags : [...tags, DEV_TAG];
    });

    ctx.ui.selectAccount(accounts[0].id);
    ctx.ui.selectTag(DEV_TAG.id);
    ctx.ui.setViewMode("all");
  } catch (error) {
    console.error('Failed to run dev scenario "open-tag-view":', error);
    ctx.ui.showToast('Dev scenario "open-tag-view" failed to open the tag view.');
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
