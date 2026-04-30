import type { ArticleDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { differenceInDays, parseDateInput } from "@/lib/datetime";
import { countStarredArticles, findLatestArticleTimestamp } from "@/lib/subscriptions-index";

export type SubscriptionReviewReasonKey = "stale_90d" | "no_unread" | "no_stars";
export type SubscriptionReviewTone = "high" | "medium" | "low";
export type SubscriptionReviewTitleKey = "review_now" | "consider" | "keep";
export type SubscriptionReviewSummaryKey =
  | "stale_and_inactive"
  | "stale_with_no_stars"
  | "inactive_without_signals"
  | "stale_but_supported"
  | "healthy_feed";

export type SubscriptionReviewReasonFactKey = "stale_days" | "unread_count" | "starred_count";

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
  articles: ArticleDto[];
  now: Date;
  hiddenFeedIds: ReadonlySet<string>;
};

export function hasSubscriptionReviewReason(
  candidate: SubscriptionReviewCandidate,
  reasonKey: SubscriptionReviewReasonKey,
): boolean {
  return candidate.reasonKeys.includes(reasonKey);
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
  return new Map(folders.map((folder) => [folder.id, folder.name]));
}

export function buildSubscriptionReviewCandidates({
  feeds,
  folders,
  articles,
  now,
  hiddenFeedIds,
}: BuildSubscriptionReviewCandidatesParams): SubscriptionReviewCandidate[] {
  const folderNameById = buildFolderNameByIdMap(folders);
  const articleGroups = new Map<string, ArticleDto[]>();

  for (const article of articles) {
    const current = articleGroups.get(article.feed_id);
    if (current) {
      current.push(article);
    } else {
      articleGroups.set(article.feed_id, [article]);
    }
  }

  return feeds
    .filter((feed) => !hiddenFeedIds.has(feed.id))
    .map((feed) => {
      const feedArticles = articleGroups.get(feed.id) ?? [];
      const latestArticleAt = findLatestArticleTimestamp(feedArticles);

      const latestArticleDate = parseDateInput(latestArticleAt);
      const staleDays = latestArticleDate === null ? null : differenceInDays(now, latestArticleDate);
      const starredCount = countStarredArticles(feedArticles);
      const reasonKeys: SubscriptionReviewReasonKey[] = [];

      if (staleDays != null && staleDays >= 90) {
        reasonKeys.push("stale_90d");
      }
      if (feed.unread_count === 0) {
        reasonKeys.push("no_unread");
      }
      if (starredCount === 0) {
        reasonKeys.push("no_stars");
      }

      return {
        feedId: feed.id,
        title: feed.title,
        folderId: feed.folder_id,
        folderName: feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null,
        latestArticleAt,
        staleDays,
        unreadCount: feed.unread_count,
        starredCount,
        reasonKeys,
      } satisfies SubscriptionReviewCandidate;
    })
    .sort((left, right) => {
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
