import type { FeedArticleSummaryDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { parseDateInput } from "@/lib/datetime";

export type SubscriptionReviewReasonKey = "stale_90d" | "no_unread" | "no_stars";
export type SubscriptionReviewTone = "high" | "medium" | "low";
export type SubscriptionReviewTitleKey = "review_now" | "consider" | "keep";
export type SubscriptionCleanupRecommendation = "cleanup_candidate" | "watch" | "retain";
export type SubscriptionReviewSummaryKey =
  | "stale_and_inactive"
  | "stale_with_no_stars"
  | "inactive_without_signals"
  | "stale_but_supported"
  | "healthy_feed";

export type SubscriptionReviewReasonFactKey = "stale_days" | "unread_count" | "starred_count";

type SubscriptionReviewSummaryTranslationKey =
  | "detail_reason_stale_and_inactive"
  | "detail_reason_stale_with_no_stars"
  | "detail_reason_inactive_without_signals"
  | "detail_reason_stale_but_supported"
  | "detail_reason_normal";
type SubscriptionReviewReasonFactTranslationKey = "fact_stale_days" | "fact_unread_count" | "fact_starred_count";

const SUBSCRIPTION_REVIEW_SUMMARY_TRANSLATION_KEY_BY_SUMMARY = {
  stale_and_inactive: "detail_reason_stale_and_inactive",
  stale_with_no_stars: "detail_reason_stale_with_no_stars",
  inactive_without_signals: "detail_reason_inactive_without_signals",
  stale_but_supported: "detail_reason_stale_but_supported",
  healthy_feed: "detail_reason_normal",
} satisfies Record<SubscriptionReviewSummaryKey, SubscriptionReviewSummaryTranslationKey>;

const SUBSCRIPTION_REVIEW_REASON_FACT_TRANSLATION_KEY_BY_FACT = {
  stale_days: "fact_stale_days",
  unread_count: "fact_unread_count",
  starred_count: "fact_starred_count",
} satisfies Record<SubscriptionReviewReasonFactKey, SubscriptionReviewReasonFactTranslationKey>;

export type SubscriptionReviewCandidate = {
  feedId: string;
  title: string;
  folderId: string | null;
  folderName: string | null;
  latestArticleAt: string | null;
  staleDays: number | null;
  unreadCount: number;
  starredCount: number;
  reasonKeys: SubscriptionReviewReasonKey[];
};

export type BuildSubscriptionReviewCandidatesParams = {
  feeds: FeedDto[];
  folders: FolderDto[];
  feedArticleSummaries: FeedArticleSummaryDto[];
  now: Date;
  hiddenFeedIds: ReadonlySet<string>;
};

export function hasSubscriptionReviewReason(
  candidate: SubscriptionReviewCandidate,
  reasonKey: SubscriptionReviewReasonKey,
): boolean {
  return candidate.reasonKeys.includes(reasonKey);
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
  const hasNoUnread = hasSubscriptionReviewReason(candidate, "no_unread");
  const hasNoStars = hasSubscriptionReviewReason(candidate, "no_stars");

  if (hasStale && hasNoUnread) {
    return {
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    };
  }

  if (hasStale && hasNoStars) {
    return {
      tone: "medium",
      titleKey: "consider",
      summaryKey: "stale_with_no_stars",
    };
  }

  if (hasNoUnread && hasNoStars) {
    return {
      tone: "medium",
      titleKey: "consider",
      summaryKey: "inactive_without_signals",
    };
  }

  if (hasStale) {
    return {
      tone: "medium",
      titleKey: "consider",
      summaryKey: "stale_but_supported",
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

  if (hasSubscriptionReviewReason(candidate, "stale_90d") && candidate.staleDays != null) {
    facts.push({ key: "stale_days", value: candidate.staleDays });
  }
  if (hasSubscriptionReviewReason(candidate, "no_unread")) {
    facts.push({ key: "unread_count", value: candidate.unreadCount });
  }
  if (hasSubscriptionReviewReason(candidate, "no_stars")) {
    facts.push({ key: "starred_count", value: candidate.starredCount });
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

function clampNonnegativeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
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

export function buildSubscriptionReviewCandidates({
  feeds,
  folders,
  feedArticleSummaries,
  now,
  hiddenFeedIds,
}: BuildSubscriptionReviewCandidatesParams): SubscriptionReviewCandidate[] {
  const folderNameById = buildFolderNameByIdMap(folders);
  const summaryByFeedId = buildFeedArticleSummaryByFeedIdMap(feedArticleSummaries);
  const candidates: SubscriptionReviewCandidate[] = [];

  for (const feed of feeds) {
    if (hiddenFeedIds.has(feed.id)) {
      continue;
    }

    const summary = summaryByFeedId.get(feed.id);
    const latestArticleAt = summary?.latest_article_at ?? null;

    const latestArticleDate = parseDateInput(latestArticleAt);
    const staleDays = latestArticleDate === null ? null : calculateSubscriptionReviewStaleDays(now, latestArticleDate);
    const unreadCount = clampNonnegativeCount(feed.unread_count);
    const starredCount = clampNonnegativeCount(summary?.starred_count ?? 0);
    const hasFetchedArticle = latestArticleAt !== null;
    const reasonKeys: SubscriptionReviewReasonKey[] = [];

    if (staleDays != null && staleDays >= 90) {
      reasonKeys.push("stale_90d");
    }
    if (hasFetchedArticle && unreadCount === 0) {
      reasonKeys.push("no_unread");
    }
    if (hasFetchedArticle && starredCount === 0) {
      reasonKeys.push("no_stars");
    }

    candidates.push({
      feedId: feed.id,
      title: feed.title,
      folderId: feed.folder_id,
      folderName: feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null,
      latestArticleAt,
      staleDays,
      unreadCount,
      starredCount,
      reasonKeys,
    });
  }

  return candidates.sort((left, right) => {
    const staleDelta = (right.staleDays ?? -1) - (left.staleDays ?? -1);
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

    const starredDelta = left.starredCount - right.starredCount;
    if (starredDelta !== 0) {
      return starredDelta;
    }

    return left.title.localeCompare(right.title);
  });
}
