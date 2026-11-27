import type { FeedArticleSummaryDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { getDateInputTimeMs, parseDateInput } from "@/lib/datetime";
import { normalizeSubscriptionCount } from "@/lib/subscriptions/subscription-count";

export type SubscriptionReviewReasonKey = "attention_30d" | "stale_90d" | "quiet_no_unread" | "no_articles";
export type SubscriptionReviewTone = "high" | "medium" | "low";
export type SubscriptionReviewTitleKey = "attention" | "review_now" | "consider" | "keep";
export type SubscriptionCleanupRecommendation = "cleanup_candidate" | "watch" | "retain";
export type SubscriptionReviewSummaryKey =
  | "attention_low_activity"
  | "stale_and_inactive"
  | "quiet_without_unread"
  | "stale_but_supported"
  | "no_articles_since_subscribed"
  | "healthy_feed";

export type SubscriptionReviewReasonFactKey = "unread_count";

type SubscriptionReviewSummaryTranslationKey =
  | "detail_reason_attention"
  | "detail_reason_stale_and_inactive"
  | "detail_reason_quiet_without_unread"
  | "detail_reason_stale_but_supported"
  | "detail_reason_no_articles"
  | "detail_reason_normal";
type SubscriptionReviewReasonFactTranslationKey = "fact_unread_count";

const SUBSCRIPTION_REVIEW_SUMMARY_TRANSLATION_KEY_BY_SUMMARY = {
  attention_low_activity: "detail_reason_attention",
  stale_and_inactive: "detail_reason_stale_and_inactive",
  quiet_without_unread: "detail_reason_quiet_without_unread",
  stale_but_supported: "detail_reason_stale_but_supported",
  no_articles_since_subscribed: "detail_reason_no_articles",
  healthy_feed: "detail_reason_normal",
} satisfies Record<SubscriptionReviewSummaryKey, SubscriptionReviewSummaryTranslationKey>;

const SUBSCRIPTION_REVIEW_REASON_FACT_TRANSLATION_KEY_BY_FACT = {
  unread_count: "fact_unread_count",
} satisfies Record<SubscriptionReviewReasonFactKey, SubscriptionReviewReasonFactTranslationKey>;

const SUBSCRIPTION_REVIEW_STALE_DAYS = 90;
const SUBSCRIPTION_REVIEW_ATTENTION_DAYS = 30;
const SUBSCRIPTION_REVIEW_QUIET_UNREAD_DAYS = 60;

export type SubscriptionReviewCandidate = {
  feedId: string;
  title: string;
  folderId: string | null;
  folderName: string | null;
  latestArticleAt: string | null;
  staleDays: number | null;
  /** Subscription age, set only for `no_articles` candidates. Not a stale-days value: there is no article date to age from. */
  sinceCreatedDays: number | null;
  unreadCount: number;
  starredCount: number;
  reasonKeys: SubscriptionReviewReasonKey[];
};

export type BuildSubscriptionReviewCandidatesParams = {
  feeds: FeedDto[];
  folders: FolderDto[];
  feedArticleSummaries: FeedArticleSummaryDto[];
  now: Date;
  /** Provider feeds are only judged by `no_articles` after the latest-article probe completes. */
  isLocalAccount: boolean;
  /** A feed that is never synced cannot show its articles, so `no_articles` does not apply. */
  isAccountSyncEnabled: boolean;
};

/** Days a feed is judged on: article staleness, or subscription age when no article was ever seen. */
export function resolveSubscriptionReviewInactiveDays(
  candidate: Pick<SubscriptionReviewCandidate, "staleDays" | "sinceCreatedDays">,
): number | null {
  return candidate.staleDays ?? candidate.sinceCreatedDays;
}

export function hasSubscriptionReviewReason(
  candidate: SubscriptionReviewCandidate,
  reasonKey: SubscriptionReviewReasonKey,
): boolean {
  return candidate.reasonKeys.includes(reasonKey);
}

export function isSubscriptionReviewCandidate(candidate: SubscriptionReviewCandidate): boolean {
  return (
    hasSubscriptionReviewReason(candidate, "stale_90d") ||
    hasSubscriptionReviewReason(candidate, "quiet_no_unread") ||
    hasSubscriptionReviewReason(candidate, "no_articles")
  );
}

export function resolveSubscriptionReviewSummaryTranslationKey(
  summaryKey: SubscriptionReviewSummaryKey,
): SubscriptionReviewSummaryTranslationKey {
  return SUBSCRIPTION_REVIEW_SUMMARY_TRANSLATION_KEY_BY_SUMMARY[summaryKey];
}

export function resolveSubscriptionReviewReasonFactTranslationKey(
  factKey: SubscriptionReviewReasonFactKey,
): SubscriptionReviewReasonFactTranslationKey {
  return SUBSCRIPTION_REVIEW_REASON_FACT_TRANSLATION_KEY_BY_FACT[factKey];
}

export function summarizeSubscriptionReviewCandidate(candidate: SubscriptionReviewCandidate): {
  tone: SubscriptionReviewTone;
  titleKey: SubscriptionReviewTitleKey;
  summaryKey: SubscriptionReviewSummaryKey;
} {
  const hasStale = hasSubscriptionReviewReason(candidate, "stale_90d");
  const hasQuietNoUnread = hasSubscriptionReviewReason(candidate, "quiet_no_unread");
  const hasAttention = hasSubscriptionReviewReason(candidate, "attention_30d");

  if (hasSubscriptionReviewReason(candidate, "no_articles")) {
    return {
      tone: "medium",
      titleKey: "consider",
      summaryKey: "no_articles_since_subscribed",
    };
  }

  if (hasStale && hasQuietNoUnread) {
    return {
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    };
  }

  if (hasQuietNoUnread) {
    return {
      tone: "medium",
      titleKey: "consider",
      summaryKey: "quiet_without_unread",
    };
  }

  if (hasStale) {
    return {
      tone: "medium",
      titleKey: "consider",
      summaryKey: "stale_but_supported",
    };
  }

  if (hasAttention) {
    return {
      tone: "low",
      titleKey: "attention",
      summaryKey: "attention_low_activity",
    };
  }

  return {
    tone: "low",
    titleKey: "keep",
    summaryKey: "healthy_feed",
  };
}

export function resolveSubscriptionCleanupRecommendation(
  candidate: SubscriptionReviewCandidate,
): SubscriptionCleanupRecommendation {
  const summary = summarizeSubscriptionReviewCandidate(candidate);

  if (summary.tone === "high") {
    return "cleanup_candidate";
  }

  if (summary.tone === "medium") {
    return "watch";
  }

  return "retain";
}

export function buildSubscriptionReviewReasonFacts(candidate: SubscriptionReviewCandidate): Array<{
  key: SubscriptionReviewReasonFactKey;
  value: number;
}> {
  const facts: Array<{ key: SubscriptionReviewReasonFactKey; value: number }> = [];

  if (hasSubscriptionReviewReason(candidate, "quiet_no_unread")) {
    facts.push({ key: "unread_count", value: candidate.unreadCount });
  }

  return facts;
}

export function buildFolderNameByIdMap(folders: FolderDto[]): Map<string, string> {
  const folderNameById = new Map<string, string>();

  for (const folder of folders) {
    folderNameById.set(folder.id, folder.name);
  }

  return folderNameById;
}

function buildFeedArticleSummaryByFeedIdMap(
  feedArticleSummaries: FeedArticleSummaryDto[],
): Map<string, FeedArticleSummaryDto> {
  const summaryByFeedId = new Map<string, FeedArticleSummaryDto>();

  for (const summary of feedArticleSummaries) {
    // Duplicate summaries can appear when backend or query merges overlap; review uses the latest merged entry.
    summaryByFeedId.set(summary.feed_id, summary);
  }

  return summaryByFeedId;
}

function getUtcCalendarDayTimeMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function calculateSubscriptionReviewStaleDays(now: Date, latestArticleDate: Date): number {
  const dayDeltaMs = getUtcCalendarDayTimeMs(now) - getUtcCalendarDayTimeMs(latestArticleDate);

  return Math.max(0, Math.floor(dayDeltaMs / 86_400_000));
}

function resolveSubscriptionReviewReasonKeys({
  staleDays,
  sinceCreatedDays,
  unreadCount,
  hasFetchedArticle,
}: {
  staleDays: number | null;
  sinceCreatedDays: number | null;
  unreadCount: number;
  hasFetchedArticle: boolean;
}): SubscriptionReviewReasonKey[] {
  if (sinceCreatedDays !== null) {
    return ["no_articles"];
  }

  if (staleDays === null) {
    return [];
  }

  const reasonKeys: SubscriptionReviewReasonKey[] = [];
  const hasStale90 = staleDays >= SUBSCRIPTION_REVIEW_STALE_DAYS;
  const hasQuietNoUnread = hasFetchedArticle && staleDays >= SUBSCRIPTION_REVIEW_QUIET_UNREAD_DAYS && unreadCount === 0;

  if (hasStale90) {
    reasonKeys.push("stale_90d");
  }
  if (hasQuietNoUnread) {
    reasonKeys.push("quiet_no_unread");
  } else if (!hasStale90 && staleDays >= SUBSCRIPTION_REVIEW_ATTENTION_DAYS) {
    reasonKeys.push("attention_30d");
  }

  return reasonKeys;
}

/** Includes activity retained after the latest locally stored article was purged. */
export function resolveLatestKnownArticleAt(
  summary: Pick<FeedArticleSummaryDto, "latest_article_at" | "last_seen_article_at"> | null | undefined,
): string | null {
  const latestArticleAt = summary?.latest_article_at ?? null;
  const lastSeenArticleAt = summary?.last_seen_article_at ?? null;
  if (latestArticleAt === null) {
    return lastSeenArticleAt;
  }
  if (lastSeenArticleAt === null) {
    return latestArticleAt;
  }

  const latestTime = getDateInputTimeMs(latestArticleAt);
  const lastSeenTime = getDateInputTimeMs(lastSeenArticleAt);
  if (latestTime === null) {
    return lastSeenArticleAt;
  }
  if (lastSeenTime === null) {
    return latestArticleAt;
  }

  return lastSeenTime > latestTime ? lastSeenArticleAt : latestArticleAt;
}

/**
 * Subscription age for a feed that never produced an article, or null when it is not a `no_articles` candidate.
 * A missing summary row is not evidence of "no articles": the summary query returns a row for every feed, so a missing
 * row means the summaries have not loaded.
 */
function resolveNoArticlesSinceCreatedDays({
  feed,
  summary,
  now,
  isLocalAccount,
  isAccountSyncEnabled,
}: {
  feed: FeedDto;
  summary: FeedArticleSummaryDto | undefined;
  now: Date;
  isLocalAccount: boolean;
  isAccountSyncEnabled: boolean;
}): number | null {
  if (!isAccountSyncEnabled || summary === undefined || resolveLatestKnownArticleAt(summary) !== null) {
    return null;
  }
  if (!isLocalAccount && feed.remote_id !== null && !summary.last_seen_article_probe_completed) {
    return null;
  }

  const createdAt = parseDateInput(feed.created_at);
  if (createdAt === null) {
    return null;
  }

  const sinceCreatedDays = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
  return sinceCreatedDays >= SUBSCRIPTION_REVIEW_STALE_DAYS ? sinceCreatedDays : null;
}

export function buildSubscriptionReviewCandidates({
  feeds,
  folders,
  feedArticleSummaries,
  now,
  isLocalAccount,
  isAccountSyncEnabled,
}: BuildSubscriptionReviewCandidatesParams): SubscriptionReviewCandidate[] {
  const folderNameById = buildFolderNameByIdMap(folders);
  const summaryByFeedId = buildFeedArticleSummaryByFeedIdMap(feedArticleSummaries);
  const candidates: SubscriptionReviewCandidate[] = [];

  for (const feed of feeds) {
    const summary = summaryByFeedId.get(feed.id);
    const latestArticleAt = resolveLatestKnownArticleAt(summary);

    const latestArticleDate = parseDateInput(latestArticleAt);
    const staleDays = latestArticleDate === null ? null : calculateSubscriptionReviewStaleDays(now, latestArticleDate);
    const unreadCount = normalizeSubscriptionCount(feed.unread_count);
    const starredCount = normalizeSubscriptionCount(summary?.starred_count ?? 0);
    const hasFetchedArticle = latestArticleAt !== null;
    const sinceCreatedDays = resolveNoArticlesSinceCreatedDays({
      feed,
      summary,
      now,
      isLocalAccount,
      isAccountSyncEnabled,
    });
    const reasonKeys = resolveSubscriptionReviewReasonKeys({
      staleDays,
      sinceCreatedDays,
      unreadCount,
      hasFetchedArticle,
    });

    candidates.push({
      feedId: feed.id,
      title: feed.title,
      folderId: feed.folder_id,
      folderName: feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null,
      latestArticleAt,
      staleDays,
      sinceCreatedDays,
      unreadCount,
      starredCount,
      reasonKeys,
    });
  }

  return candidates.sort((left, right) => {
    const staleDelta =
      (resolveSubscriptionReviewInactiveDays(right) ?? -1) - (resolveSubscriptionReviewInactiveDays(left) ?? -1);
    if (staleDelta !== 0) {
      return staleDelta;
    }

    const reasonDelta = right.reasonKeys.length - left.reasonKeys.length;
    if (reasonDelta !== 0) {
      return reasonDelta;
    }

    const unreadDelta = left.unreadCount - right.unreadCount;
    if (unreadDelta !== 0) {
      return unreadDelta;
    }

    return left.title.localeCompare(right.title);
  });
}
