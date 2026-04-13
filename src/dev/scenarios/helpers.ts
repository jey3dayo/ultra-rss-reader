import type { AccountDto, ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import {
  DEV_FEED_DISPLAY_MODE_SCORE,
  DEV_FEED_HINT_SCORE_STEP,
  DEV_FEED_MAX_UNREAD_SCORE,
  DEV_WINDOW_RESIZE_RETRY_DELAYS_MS,
  DEV_WINDOW_RESIZE_TOLERANCE_PX,
  DEV_WINDOW_UNMAXIMIZE_SETTLE_DELAY_MS,
  OPEN_WEB_PREVIEW_URL_SCENARIO_REPLAY_DELAY_MS,
  OPEN_WEB_PREVIEW_URL_SCENARIO_REPLAY_LATE_DELAY_MS,
} from "@/dev/scenarios/constants";
import type { DevScenario, DevScenarioContext, DevScenarioId } from "@/dev/scenarios/types";
import { loadDevRuntimeOptions, readDevWebUrl, readDevWindowSize } from "@/lib/dev-intent";
import { resolveFeedLandingArticle } from "@/lib/feed-landing";
import { usePreferencesStore } from "@/stores/preferences-store";

type LandingFeedSelection = {
  account: AccountDto;
  feed: FeedDto;
  articles: ArticleDto[];
  article: ArticleDto;
};

type TagScenarioSelection = {
  account: AccountDto;
  tag: TagDto;
  counts: Record<string, number>;
  articles: ArticleDto[];
};

const DEFAULT_DEV_FEED_HINTS = ["マガポケ", "ジャンプ+", "comic", "manga", "少年ジャンプ", "ゴリミー"];

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

async function findRankedLandingFeedSelection(
  ctx: DevScenarioContext,
  accounts: readonly AccountDto[],
): Promise<LandingFeedSelection | null> {
  for (const account of accounts) {
    const feeds = await Promise.resolve(ctx.actions.listFeeds(account.id));
    ctx.queryClient.setQueryData(["feeds", account.id], feeds);

    for (const candidateFeed of rankPreferredDevFeeds(feeds)) {
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

export async function runOpenWebPreviewUrlScenario(ctx: DevScenarioContext): Promise<void> {
  await loadDevRuntimeOptions();
  const webUrl = readDevWebUrl();
  if (!webUrl) {
    ctx.ui.showToast('Dev scenario "open-web-preview-url" requires VITE_DEV_WEB_URL.');
    return;
  }

  await applyDevWindowSize();

  const applyPreviewState = () => {
    void applyDevWindowSize();
    ctx.ui.openBrowser(webUrl);
  };

  applyPreviewState();
  window.setTimeout(applyPreviewState, OPEN_WEB_PREVIEW_URL_SCENARIO_REPLAY_DELAY_MS);
  window.setTimeout(applyPreviewState, OPEN_WEB_PREVIEW_URL_SCENARIO_REPLAY_LATE_DELAY_MS);
}

function sizeMatchesWithinTolerance(
  current: { width: number; height: number },
  target: { width: number; height: number },
): boolean {
  return (
    Math.abs(current.width - target.width) <= DEV_WINDOW_RESIZE_TOLERANCE_PX &&
    Math.abs(current.height - target.height) <= DEV_WINDOW_RESIZE_TOLERANCE_PX
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function applyDevWindowSize(): Promise<void> {
  const requestedSize = readDevWindowSize();
  if (!requestedSize) {
    return;
  }

  try {
    const [{ LogicalSize }, { getCurrentWindow }] = await Promise.all([
      import("@tauri-apps/api/dpi"),
      import("@tauri-apps/api/window"),
    ]);
    const win = getCurrentWindow();

    if (await win.isMaximized()) {
      await win.unmaximize();
      await wait(DEV_WINDOW_UNMAXIMIZE_SETTLE_DELAY_MS);
    }

    const readCurrentLogicalSize = async () => {
      const scaleFactor = await win.scaleFactor();
      const logicalSize = (await win.innerSize()).toLogical(scaleFactor);
      return {
        width: Math.round(logicalSize.width),
        height: Math.round(logicalSize.height),
      };
    };

    const initialSize = await readCurrentLogicalSize();
    const targetSize = {
      width: requestedSize.width ?? initialSize.width,
      height: requestedSize.height ?? initialSize.height,
    };

    for (const delayMs of DEV_WINDOW_RESIZE_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await wait(delayMs);
      }

      const currentSize = await readCurrentLogicalSize();
      if (sizeMatchesWithinTolerance(currentSize, targetSize)) {
        await win.center();
        return;
      }

      await win.setSize(new LogicalSize(targetSize.width, targetSize.height));
      await win.center();
    }

    const finalSize = await readCurrentLogicalSize();
    if (!sizeMatchesWithinTolerance(finalSize, targetSize)) {
      console.warn('Dev scenario "open-web-preview-url" did not reach the requested window size.', {
        targetSize,
        finalSize,
      });
    }
  } catch (error) {
    console.warn('Dev scenario "open-web-preview-url" could not apply the requested window size.', error);
  }
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

function rankPreferredDevFeeds(feeds: FeedDto[]): FeedDto[] {
  return [...feeds].sort((left, right) => scorePreferredDevFeed(right) - scorePreferredDevFeed(left));
}

function scorePreferredDevFeed(feed: FeedDto): number {
  const normalized = [feed.title, feed.url, feed.site_url].filter(Boolean).join(" ").toLowerCase();
  const hintScore = DEFAULT_DEV_FEED_HINTS.reduce((score, hint, index) => {
    return normalized.includes(hint.toLowerCase())
      ? score + (DEFAULT_DEV_FEED_HINTS.length - index) * DEV_FEED_HINT_SCORE_STEP
      : score;
  }, 0);

  const unreadScore = Math.min(feed.unread_count, DEV_FEED_MAX_UNREAD_SCORE);
  const displayModeScore =
    feed.reader_mode === "on" && feed.web_preview_mode === "on" ? DEV_FEED_DISPLAY_MODE_SCORE : 0;
  return displayModeScore + hintScore + unreadScore;
}
