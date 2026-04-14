import type { ArticleDto, FeedDto, FolderDto } from "@/api/tauri-commands";

export type FeedCleanupReasonKey = "stale_90d" | "no_unread" | "no_stars";
export type FeedCleanupTone = "high" | "medium" | "low";
export type FeedCleanupTitleKey = "review_now" | "consider" | "keep";
export type FeedCleanupSummaryKey =
  | "stale_and_inactive"
  | "stale_with_no_stars"
  | "inactive_without_signals"
  | "stale_but_supported"
  | "healthy_feed";

export type FeedCleanupReasonFactKey = "stale_days" | "unread_count" | "starred_count";

export type FeedCleanupCandidate = {
  feedId: string;
  title: string;
  folderId: string | null;
  folderName: string | null;
  latestArticleAt: string | null;
  staleDays: number | null;
  unreadCount: number;
  starredCount: number;
  reasonKeys: FeedCleanupReasonKey[];
};

export type BuildFeedCleanupCandidatesParams = {
  feeds: FeedDto[];
  folders: FolderDto[];
  articles: ArticleDto[];
  now: Date;
  hiddenFeedIds: ReadonlySet<string>;
};

export function summarizeCleanupCandidate(candidate: FeedCleanupCandidate): {
  tone: FeedCleanupTone;
  titleKey: FeedCleanupTitleKey;
  summaryKey: FeedCleanupSummaryKey;
} {
  const hasStale = candidate.reasonKeys.includes("stale_90d");
  const hasNoUnread = candidate.reasonKeys.includes("no_unread");
  const hasNoStars = candidate.reasonKeys.includes("no_stars");

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

export function buildCleanupReasonFacts(candidate: FeedCleanupCandidate): Array<{
  key: FeedCleanupReasonFactKey;
  value: number;
}> {
  const facts: Array<{ key: FeedCleanupReasonFactKey; value: number }> = [];

  if (candidate.reasonKeys.includes("stale_90d") && candidate.staleDays != null) {
    facts.push({ key: "stale_days", value: candidate.staleDays });
  }
  if (candidate.reasonKeys.includes("no_unread")) {
    facts.push({ key: "unread_count", value: candidate.unreadCount });
  }
  if (candidate.reasonKeys.includes("no_stars")) {
    facts.push({ key: "starred_count", value: candidate.starredCount });
  }

  return facts;
}

export function buildFeedCleanupCandidates({
  feeds,
  folders,
  articles,
  now,
  hiddenFeedIds,
}: BuildFeedCleanupCandidatesParams): FeedCleanupCandidate[] {
  const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]));
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
      const latestArticleAt = feedArticles.reduce<string | null>((latest, article) => {
        if (!latest) {
          return article.published_at;
        }
        return new Date(article.published_at).getTime() > new Date(latest).getTime() ? article.published_at : latest;
      }, null);

      const staleDays =
        latestArticleAt == null
          ? null
          : Math.floor((now.getTime() - new Date(latestArticleAt).getTime()) / (1000 * 60 * 60 * 24));
      const starredCount = feedArticles.filter((article) => article.is_starred).length;
      const reasonKeys: FeedCleanupReasonKey[] = [];

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
      } satisfies FeedCleanupCandidate;
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
