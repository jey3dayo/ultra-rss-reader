import type { QueryKey } from "@tanstack/react-query";
import type { AccountDto, ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import { loadDevRuntimeOptions, readDevWebUrl, readDevWindowSize } from "@/dev/intent";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
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
import type { DevScenarioContext } from "@/dev/scenarios/types";
import { tagQueryKeys } from "@/hooks/use-tags";
import { resolveFeedLandingArticle } from "@/lib/feed/feed-landing";
import { queryKeys } from "@/lib/query/query-invalidation";
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

type DevScenarioSeedEntry = {
  key: QueryKey;
  data: unknown;
};

type DevScenarioSeedDraft = {
  entries: DevScenarioSeedEntry[];
};

const DEFAULT_DEV_FEED_HINTS = ["マガポケ", "ジャンプ+", "comic", "manga", "少年ジャンプ", "ゴリミー"];
const OPEN_WEB_PREVIEW_URL_REPLAY_DELAYS_MS = [
  OPEN_WEB_PREVIEW_URL_SCENARIO_REPLAY_DELAY_MS,
  OPEN_WEB_PREVIEW_URL_SCENARIO_REPLAY_LATE_DELAY_MS,
] as const;

let openWebPreviewUrlReplayGeneration = 0;
let openWebPreviewUrlReplayTimerIds: number[] = [];

export function cancelOpenWebPreviewUrlScenarioReplay(): void {
  openWebPreviewUrlReplayGeneration += 1;
  for (const timerId of openWebPreviewUrlReplayTimerIds) {
    window.clearTimeout(timerId);
  }
  openWebPreviewUrlReplayTimerIds = [];
}

function beginOpenWebPreviewUrlScenarioReplay(): number {
  cancelOpenWebPreviewUrlScenarioReplay();
  return openWebPreviewUrlReplayGeneration;
}

function isCurrentOpenWebPreviewUrlScenarioReplay(generation: number): boolean {
  return generation === openWebPreviewUrlReplayGeneration;
}

function isCurrentDevScenarioRun(ctx: DevScenarioContext): boolean {
  return ctx.isCurrentRun?.() ?? true;
}

function createDevScenarioSeedDraft(): DevScenarioSeedDraft {
  return {
    entries: [],
  };
}

function stageDevScenarioQueryData(draft: DevScenarioSeedDraft, key: QueryKey, data: unknown): void {
  const existingEntryIndex = draft.entries.findIndex((entry) => JSON.stringify(entry.key) === JSON.stringify(key));
  if (existingEntryIndex >= 0) {
    draft.entries[existingEntryIndex] = { key, data };
    return;
  }

  draft.entries.push({ key, data });
}

function commitDevScenarioSeedDraft(ctx: DevScenarioContext, draft: DevScenarioSeedDraft): void {
  if (!isCurrentDevScenarioRun(ctx)) {
    return;
  }

  for (const entry of draft.entries) {
    ctx.queryClient.setQueryData(entry.key, entry.data);
  }
}

async function stageAccounts(ctx: DevScenarioContext, draft: DevScenarioSeedDraft): Promise<AccountDto[] | null> {
  const accounts = await Promise.resolve(ctx.actions.listAccounts());
  if (!isCurrentDevScenarioRun(ctx)) {
    return null;
  }
  stageDevScenarioQueryData(draft, ["accounts"], accounts);
  return accounts;
}

async function findRankedLandingFeedSelection(
  ctx: DevScenarioContext,
  draft: DevScenarioSeedDraft,
  accounts: readonly AccountDto[],
): Promise<LandingFeedSelection | null> {
  // Preserve first-match selection order and the matching query-cache writes.
  for (const account of accounts) {
    const feeds = await Promise.resolve(ctx.actions.listFeeds(account.id));
    if (!isCurrentDevScenarioRun(ctx)) {
      return null;
    }
    stageDevScenarioQueryData(draft, queryKeys.feeds.byAccount(account.id), feeds);

    for (const candidateFeed of rankPreferredDevFeeds(feeds)) {
      const candidateArticles = await Promise.resolve(ctx.actions.listArticles(candidateFeed.id));
      if (!isCurrentDevScenarioRun(ctx)) {
        return null;
      }
      stageDevScenarioQueryData(draft, queryKeys.articles.byFeed(candidateFeed.id, "all"), candidateArticles);
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
  draft: DevScenarioSeedDraft,
  accountId: string,
  feedId: string,
  readerMode: FeedDto["reader_mode"],
  webPreviewMode: FeedDto["web_preview_mode"],
): void {
  const feedsKey = queryKeys.feeds.byAccount(accountId);
  const feedsEntry = draft.entries.find((entry) => JSON.stringify(entry.key) === JSON.stringify(feedsKey));
  if (!feedsEntry || !Array.isArray(feedsEntry.data)) {
    return;
  }

  stageDevScenarioQueryData(
    draft,
    feedsKey,
    feedsEntry.data.map((feed: FeedDto) =>
      feed.id === feedId
        ? {
            ...feed,
            reader_mode: readerMode,
            web_preview_mode: webPreviewMode,
          }
        : feed,
    ),
  );
}

function selectFeedArticle(
  ctx: DevScenarioContext,
  draft: DevScenarioSeedDraft,
  accountId: string,
  feedId: string,
  articleId: string,
  readerMode: FeedDto["reader_mode"],
  webPreviewMode: FeedDto["web_preview_mode"],
): void {
  updateFeedDisplayModes(draft, accountId, feedId, readerMode, webPreviewMode);
  commitDevScenarioSeedDraft(ctx, draft);
  if (!isCurrentDevScenarioRun(ctx)) {
    return;
  }
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
  draft: DevScenarioSeedDraft,
  account: AccountDto,
): Promise<TagScenarioSelection | null> {
  const tags = await Promise.resolve(ctx.actions.listTags());
  if (!isCurrentDevScenarioRun(ctx)) {
    return null;
  }
  stageDevScenarioQueryData(draft, tagQueryKeys.tags.root, tags);
  if (tags.length === 0) {
    return null;
  }

  const counts = await Promise.resolve(ctx.actions.getTagArticleCounts(account.id));
  if (!isCurrentDevScenarioRun(ctx)) {
    return null;
  }
  stageDevScenarioQueryData(draft, tagQueryKeys.tagArticleCounts.byAccount(account.id), counts);

  const prioritizedTags = [
    ...tags.filter((tag) => (counts[tag.id] ?? 0) > 0),
    ...tags.filter((tag) => (counts[tag.id] ?? 0) <= 0),
  ];

  // Preserve tag priority because the first tag with articles becomes the opened view.
  for (const tag of prioritizedTags) {
    const articles = await Promise.resolve(ctx.actions.listArticlesByTag(tag.id, undefined, undefined, account.id));
    if (!isCurrentDevScenarioRun(ctx)) {
      return null;
    }
    stageDevScenarioQueryData(draft, tagQueryKeys.articlesByTag.byTagAndAccount(tag.id, account.id, "all"), articles);
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
    ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" requires VITE_DEV_WEB_URL.`);
    return;
  }

  const replayGeneration = beginOpenWebPreviewUrlScenarioReplay();
  const isCurrentReplay = () => isCurrentOpenWebPreviewUrlScenarioReplay(replayGeneration);

  await applyDevWindowSize(ctx.ui.showToast, isCurrentReplay);
  if (!isCurrentReplay()) {
    return;
  }

  const applyPreviewState = () => {
    if (!isCurrentReplay()) {
      return;
    }

    void applyDevWindowSize(ctx.ui.showToast, isCurrentReplay).then(() => {
      if (isCurrentReplay()) {
        ctx.ui.openBrowser(webUrl);
      }
    });
  };

  applyPreviewState();
  openWebPreviewUrlReplayTimerIds = OPEN_WEB_PREVIEW_URL_REPLAY_DELAYS_MS.map((delayMs) =>
    window.setTimeout(applyPreviewState, delayMs),
  );
}

type WindowSizeLike = {
  width: number;
  height: number;
};

type RequestedWindowSize = {
  width?: number | null;
  height?: number | null;
};

type DevWindowLike = {
  scaleFactor(): Promise<number>;
  innerSize(): Promise<{
    toLogical(scaleFactor: number): {
      width: number;
      height: number;
    };
  }>;
};

type DevWindowSizeVerification = {
  currentSize: WindowSizeLike;
  isWithinTolerance: boolean;
};

type LogicalSizeConstructor<TSize> = new (width: number, height: number) => TSize;

type DevWindowResizeLike<TSize> = DevWindowLike & {
  setSize(size: TSize): Promise<void>;
  center(): Promise<void>;
};

async function readCurrentLogicalWindowSize(win: DevWindowLike): Promise<WindowSizeLike> {
  const scaleFactor = await win.scaleFactor();
  const logicalSize = (await win.innerSize()).toLogical(scaleFactor);
  return {
    width: Math.round(logicalSize.width),
    height: Math.round(logicalSize.height),
  };
}

async function resolveTargetLogicalWindowSize(
  win: DevWindowLike,
  requestedSize: RequestedWindowSize,
): Promise<WindowSizeLike> {
  const currentSize = await readCurrentLogicalWindowSize(win);
  return resolveTargetWindowSize(requestedSize, currentSize);
}

function resolveTargetWindowSize(requestedSize: RequestedWindowSize, currentSize: WindowSizeLike): WindowSizeLike {
  return {
    width: requestedSize.width ?? currentSize.width,
    height: requestedSize.height ?? currentSize.height,
  };
}

function isWindowSizeWithinTolerance(current: WindowSizeLike, target: WindowSizeLike): boolean {
  return (
    Math.abs(current.width - target.width) <= DEV_WINDOW_RESIZE_TOLERANCE_PX &&
    Math.abs(current.height - target.height) <= DEV_WINDOW_RESIZE_TOLERANCE_PX
  );
}

async function verifyCurrentLogicalWindowSize(
  win: DevWindowLike,
  targetSize: WindowSizeLike,
): Promise<DevWindowSizeVerification> {
  const currentSize = await readCurrentLogicalWindowSize(win);
  return {
    currentSize,
    isWithinTolerance: isWindowSizeWithinTolerance(currentSize, targetSize),
  };
}

async function applyVerifiedDevWindowResizeAttempt<TSize>(
  win: DevWindowResizeLike<TSize>,
  LogicalSize: LogicalSizeConstructor<TSize>,
  targetSize: WindowSizeLike,
  delayMs: number,
  shouldContinue: () => boolean,
): Promise<boolean> {
  if (delayMs > 0) {
    await wait(delayMs);
  }
  if (!shouldContinue()) {
    return true;
  }

  const verification = await verifyCurrentLogicalWindowSize(win, targetSize);
  if (!shouldContinue()) {
    return true;
  }
  if (verification.isWithinTolerance) {
    await win.center();
    return true;
  }

  await win.setSize(new LogicalSize(targetSize.width, targetSize.height));
  if (!shouldContinue()) {
    return true;
  }
  await win.center();
  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function applyDevWindowSize(
  showToast: (message: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  const requestedSize = readDevWindowSize();
  if (!requestedSize || !shouldContinue()) {
    return;
  }

  try {
    const [{ LogicalSize }, { getCurrentWindow }] = await Promise.all([
      import("@tauri-apps/api/dpi"),
      import("@tauri-apps/api/window"),
    ]);
    if (!shouldContinue()) {
      return;
    }
    const win = getCurrentWindow();

    if (await win.isMaximized()) {
      await win.unmaximize();
      await wait(DEV_WINDOW_UNMAXIMIZE_SETTLE_DELAY_MS);
      if (!shouldContinue()) {
        return;
      }
    }

    const targetSize = await resolveTargetLogicalWindowSize(win, requestedSize);
    if (!shouldContinue()) {
      return;
    }

    // Resize retries are sequential because each pass depends on the previous size, center, and settle delay.
    for (const delayMs of DEV_WINDOW_RESIZE_RETRY_DELAYS_MS) {
      if (!shouldContinue()) {
        return;
      }
      if (await applyVerifiedDevWindowResizeAttempt(win, LogicalSize, targetSize, delayMs, shouldContinue)) {
        return;
      }
    }

    if (!shouldContinue()) {
      return;
    }
    const finalVerification = await verifyCurrentLogicalWindowSize(win, targetSize);
    if (!finalVerification.isWithinTolerance) {
      console.warn(`Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" did not reach the requested window size.`, {
        targetSize,
        finalSize: finalVerification.currentSize,
      });
      if (shouldContinue()) {
        showToast(`Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" could not verify the requested window size.`);
      }
    }
  } catch (error) {
    if (!shouldContinue()) {
      return;
    }
    console.warn(
      `Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" could not apply the requested window size.`,
      error,
    );
    showToast(`Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" could not apply the requested window size.`);
  }
}

export async function runOpenFeedFirstArticleScenario(ctx: DevScenarioContext): Promise<void> {
  try {
    const seedDraft = createDevScenarioSeedDraft();
    const accounts = await stageAccounts(ctx, seedDraft);
    if (!accounts) {
      return;
    }
    if (accounts.length === 0) {
      ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openFeedFirstArticle}" could not find any accounts.`);
      return;
    }

    const selection = await findRankedLandingFeedSelection(ctx, seedDraft, accounts);
    if (!isCurrentDevScenarioRun(ctx)) {
      return;
    }
    if (!selection) {
      ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openFeedFirstArticle}" could not find any articles.`);
      return;
    }

    selectFeedArticle(ctx, seedDraft, selection.account.id, selection.feed.id, selection.article.id, "on", "off");
  } catch (error) {
    if (!isCurrentDevScenarioRun(ctx)) {
      return;
    }
    console.error(`Failed to run dev scenario "${DEV_SCENARIO_ID.openFeedFirstArticle}":`, error);
    ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openFeedFirstArticle}" failed to open a feed article.`);
  }
}

export async function runOpenTagViewScenario(ctx: DevScenarioContext): Promise<void> {
  try {
    const seedDraft = createDevScenarioSeedDraft();
    const accounts = await stageAccounts(ctx, seedDraft);
    if (!accounts) {
      return;
    }
    if (accounts.length === 0) {
      ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openTagView}" could not find any accounts.`);
      return;
    }

    const accountSelection = resolvePreferredScenarioAccount(accounts, ctx.ui.selectedAccountId);
    if (!accountSelection) {
      ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openTagView}" could not find any accounts.`);
      return;
    }

    const selection = await findTagScenarioSelection(ctx, seedDraft, accountSelection.account);
    if (!isCurrentDevScenarioRun(ctx)) {
      return;
    }
    if (!selection) {
      ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openTagView}" could not find any articles.`);
      return;
    }

    commitDevScenarioSeedDraft(ctx, seedDraft);
    if (!isCurrentDevScenarioRun(ctx)) {
      return;
    }
    if (accountSelection.shouldSelectAccount) {
      ctx.ui.selectAccount(selection.account.id);
    }

    ctx.ui.selectTag(selection.tag.id);
    ctx.ui.setViewMode("all");
  } catch (error) {
    if (!isCurrentDevScenarioRun(ctx)) {
      return;
    }
    console.error(`Failed to run dev scenario "${DEV_SCENARIO_ID.openTagView}":`, error);
    ctx.ui.showToast(`Dev scenario "${DEV_SCENARIO_ID.openTagView}" failed to open the tag view.`);
  }
}

function rankPreferredDevFeeds(feeds: FeedDto[]): FeedDto[] {
  return feeds.toSorted((left, right) => scorePreferredDevFeed(right) - scorePreferredDevFeed(left));
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
