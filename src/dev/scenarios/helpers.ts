import type { AccountDto, ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import type { DevScenario, DevScenarioContext, DevScenarioId } from "@/dev/scenarios/types";
import {
  pickImageViewerOverlayArticle as pickImageViewerOverlayArticleForRuntime,
  rankImageViewerOverlayFeeds as rankImageViewerOverlayFeedsForRuntime,
  resolveImageViewerOverlayBrowserUrl as resolveImageViewerOverlayBrowserUrlForRuntime,
} from "@/lib/dev-image-viewer-overlay";
import { readDevWebUrl } from "@/lib/dev-intent";
import { resolveFeedLandingArticle } from "@/lib/feed-landing";
import { usePreferencesStore } from "@/stores/preferences-store";

type RankedFeedSelection = {
  account: AccountDto;
  feed: FeedDto;
  articles: ArticleDto[];
};

type LandingFeedSelection = RankedFeedSelection & {
  article: ArticleDto;
};

type TagScenarioSelection = {
  account: AccountDto;
  tag: TagDto;
  counts: Record<string, number>;
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

async function findRankedLandingFeedSelection(
  ctx: DevScenarioContext,
  accounts: readonly AccountDto[],
): Promise<LandingFeedSelection | null> {
  for (const account of accounts) {
    const feeds = await Promise.resolve(ctx.actions.listFeeds(account.id));
    ctx.queryClient.setQueryData(["feeds", account.id], feeds);

    for (const candidateFeed of rankImageViewerOverlayFeeds(feeds)) {
      const candidateArticles = await Promise.resolve(ctx.actions.listArticles(candidateFeed.id));
      ctx.queryClient.setQueryData(["articles", candidateFeed.id], candidateArticles);
      if (candidateArticles.length === 0) {
        continue;
      }

      const article = pickFeedLandingArticle(candidateArticles);
      if (!article) {
        continue;
      }

      return {
        account,
        feed: candidateFeed,
        articles: candidateArticles,
        article,
      };
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

function getSortUnreadPreference(): string {
  const prefs = usePreferencesStore.getState().prefs;
  return prefs.reading_sort ?? prefs.sort_unread ?? "newest_first";
}

function pickFeedLandingArticle(articles: ArticleDto[]): ArticleDto | null {
  return resolveFeedLandingArticle({
    articles,
    sortUnread: getSortUnreadPreference(),
  });
}

function resolvePreferredScenarioAccount(
  accounts: readonly AccountDto[],
  selectedAccountId: string | null,
): { account: AccountDto; shouldSelectAccount: boolean } | null {
  if (accounts.length === 0) {
    return null;
  }

  const selectedAccount = selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) : null;
  if (selectedAccount) {
    return { account: selectedAccount, shouldSelectAccount: false };
  }

  return { account: accounts[0], shouldSelectAccount: true };
}

async function findTagScenarioSelection(
  ctx: DevScenarioContext,
  account: AccountDto,
): Promise<TagScenarioSelection | null> {
  const tags = await Promise.resolve(ctx.actions.listTags());
  ctx.queryClient.setQueryData(["tags"], tags);
  if (tags.length === 0) {
    return null;
  }

  const counts = await Promise.resolve(ctx.actions.getTagArticleCounts(account.id));
  ctx.queryClient.setQueryData(["tagArticleCounts", account.id], counts);

  const prioritizedTags = [
    ...tags.filter((tag) => (counts[tag.id] ?? 0) > 0),
    ...tags.filter((tag) => (counts[tag.id] ?? 0) <= 0),
  ];

  for (const tag of prioritizedTags) {
    const articles = await Promise.resolve(ctx.actions.listArticlesByTag(tag.id, undefined, undefined, account.id));
    ctx.queryClient.setQueryData(["articlesByTag", tag.id, account.id], articles);
    if (articles.length > 0) {
      return {
        account,
        tag,
        counts,
        articles,
      };
    }
  }

  return null;
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

export async function runOpenWebPreviewUrlScenario(ctx: DevScenarioContext): Promise<void> {
  const webUrl = readDevWebUrl();
  if (!webUrl) {
    ctx.ui.showToast('Dev scenario "open-web-preview-url" requires VITE_DEV_WEB_URL.');
    return;
  }

  const applyPreviewState = () => {
    ctx.ui.openBrowser(webUrl);
  };

  applyPreviewState();
  window.setTimeout(applyPreviewState, 300);
  window.setTimeout(applyPreviewState, 1200);
}

export async function runOpenFeedFirstArticleScenario(ctx: DevScenarioContext): Promise<void> {
  try {
    const accounts = await cacheAccounts(ctx);
    if (accounts.length === 0) {
      ctx.ui.showToast('Dev scenario "open-feed-first-article" could not find any accounts.');
      return;
    }

    const selection = await findRankedLandingFeedSelection(ctx, accounts);
    if (!selection) {
      ctx.ui.showToast('Dev scenario "open-feed-first-article" could not find any articles.');
      return;
    }

    selectFeedArticle(ctx, selection.account.id, selection.feed.id, selection.article.id, "on", "off");
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

    const accountSelection = resolvePreferredScenarioAccount(accounts, ctx.ui.selectedAccountId);
    if (!accountSelection) {
      ctx.ui.showToast('Dev scenario "open-tag-view" could not find any accounts.');
      return;
    }

    const selection = await findTagScenarioSelection(ctx, accountSelection.account);
    if (!selection) {
      ctx.ui.showToast('Dev scenario "open-tag-view" could not find any articles.');
      return;
    }

    if (accountSelection.shouldSelectAccount) {
      ctx.ui.selectAccount(selection.account.id);
    }

    ctx.ui.selectTag(selection.tag.id);
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
