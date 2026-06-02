import type { ArticleDto, MuteKeywordDto } from "@/api/tauri-commands";
import {
  mockAccounts,
  mockArticles,
  mockArticleTags,
  mockFeeds,
  mockFolders,
  resetMockDataForDevMocks,
} from "@/dev/mock-data";
import { stripHtmlTags } from "@/lib/content/html";

let nextAccountId = 100;
let nextFeedId = 100;
let nextFolderId = 100;
let nextTagId = 100;
let nextMuteKeywordId = 100;

export const mockPreferences = new Map<string, string>();
export const mockMuteKeywords: MuteKeywordDto[] = [];
export const mockArticleViewHistory: {
  accountId: string;
  articleId: string;
  viewedAt: string;
}[] = [];

const initialMockArticleViewHistory: typeof mockArticleViewHistory = [
  {
    accountId: "acc-freshrss",
    articleId: "art-2",
    viewedAt: "2026-04-20T10:00:00Z",
  },
  {
    accountId: "acc-freshrss",
    articleId: "art-1",
    viewedAt: "2026-04-20T09:30:00Z",
  },
];

export function resetDevMockDataState() {
  nextAccountId = 100;
  nextFeedId = 100;
  nextFolderId = 100;
  nextTagId = 100;
  nextMuteKeywordId = 100;
  mockPreferences.clear();
  mockMuteKeywords.splice(0);
  mockArticleViewHistory.splice(
    0,
    mockArticleViewHistory.length,
    ...initialMockArticleViewHistory.map((item) => structuredClone(item)),
  );
  resetMockDataForDevMocks();
}

export function takeNextDevMockAccountId(): number {
  const id = nextAccountId;
  nextAccountId += 1;
  return id;
}

export function takeNextDevMockFeedId(): number {
  const id = nextFeedId;
  nextFeedId += 1;
  return id;
}

export function takeNextDevMockFolderId(): number {
  const id = nextFolderId;
  nextFolderId += 1;
  return id;
}

export function takeNextDevMockMuteKeywordId(): number {
  const id = nextMuteKeywordId;
  nextMuteKeywordId += 1;
  return id;
}

export function takeNextDevMockTagId(): number {
  const id = nextTagId;
  nextTagId += 1;
  return id;
}

export function titleFromUrl(feedUrl: string): string {
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, "");
  } catch {
    return feedUrl;
  }
}

export function recalcUnread(feedId: string) {
  const feed = mockFeeds.find((f) => f.id === feedId);
  if (feed) {
    let unreadCount = 0;
    for (const article of mockArticles) {
      if (article.feed_id === feedId && !article.is_read) {
        unreadCount += 1;
      }
    }
    feed.unread_count = unreadCount;
  }
}

export function collectFeedIdsByAccount(accountId: string): Set<string> {
  const feedIds = new Set<string>();

  for (const feed of mockFeeds) {
    if (feed.account_id === accountId) {
      feedIds.add(feed.id);
    }
  }

  return feedIds;
}

export function collectFeedIdsByFolder(folderId: string): Set<string> {
  const feedIds = new Set<string>();

  for (const feed of mockFeeds) {
    if (feed.folder_id === folderId) {
      feedIds.add(feed.id);
    }
  }

  return feedIds;
}

export function countUnreadByAccount(accountId: string) {
  const feedIds = collectFeedIdsByAccount(accountId);
  let unreadCount = 0;
  for (const article of mockArticles) {
    if (feedIds.has(article.feed_id) && !article.is_read) {
      unreadCount += 1;
    }
  }
  return unreadCount;
}

export function countStarredByAccount(accountId: string) {
  const feedIds = collectFeedIdsByAccount(accountId);
  let starredCount = 0;
  for (const article of mockArticles) {
    if (feedIds.has(article.feed_id) && article.is_starred) {
      starredCount += 1;
    }
  }
  return starredCount;
}

function resolveOldUnreadFeedIds(scopeKind: "account" | "feed" | "folder", targetId: string) {
  if (scopeKind === "account") {
    return [...collectFeedIdsByAccount(targetId)];
  }
  if (scopeKind === "folder") {
    return [...collectFeedIdsByFolder(targetId)];
  }
  return [targetId];
}

export function findOldUnreadArticles(
  scopeKind: "account" | "feed" | "folder",
  targetId: string,
  olderThanDays: 7 | 30 | 90,
) {
  const feedIds = new Set(resolveOldUnreadFeedIds(scopeKind, targetId));
  const threshold = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  return mockArticles.filter((article) => {
    const publishedAt = Date.parse(article.published_at);
    return feedIds.has(article.feed_id) && !article.is_read && Number.isFinite(publishedAt) && publishedAt < threshold;
  });
}

export function applyMuteKeywordFilter<
  T extends {
    title: string;
    content_sanitized: string;
    summary: string | null;
  },
>(articles: T[]) {
  if (mockMuteKeywords.length === 0) {
    return articles;
  }

  const normalize = (value: string) => value.trim().toLowerCase();
  const extractBodyText = (article: T) => {
    if (!article.content_sanitized.trim()) {
      return article.summary ?? "";
    }

    const visibleText = stripHtmlTags(article.content_sanitized);

    return visibleText.trim() ? visibleText : (article.summary ?? "");
  };

  return articles.filter((article) => {
    const title = normalize(article.title);
    const body = normalize(extractBodyText(article));

    return !mockMuteKeywords.some((rule) => {
      const keyword = normalize(rule.keyword);
      if (!keyword) {
        return false;
      }
      if (rule.scope === "title") {
        return title.includes(keyword);
      }
      if (rule.scope === "body") {
        return body.includes(keyword);
      }
      return title.includes(keyword) || body.includes(keyword);
    });
  });
}

export function findLatestPublishedAt(articles: readonly ArticleDto[]): string | null {
  return articles.reduce<{ publishedAt: string | null; publishedTime: number }>(
    (latest, article) => {
      const publishedTime = Date.parse(article.published_at);
      if (!Number.isFinite(publishedTime)) {
        return latest;
      }

      const nextPublishedTime = Math.max(latest.publishedTime, publishedTime);
      if (nextPublishedTime === latest.publishedTime) {
        return latest;
      }

      return {
        publishedAt: article.published_at,
        publishedTime: nextPublishedTime,
      };
    },
    { publishedAt: null, publishedTime: Number.NEGATIVE_INFINITY },
  ).publishedAt;
}

export function deleteDevMockAccount(accountId: string) {
  const idx = mockAccounts.findIndex((a) => a.id === accountId);
  if (idx >= 0) mockAccounts.splice(idx, 1);
  const removedFeedIds = new Set<string>();
  for (const feed of mockFeeds) {
    if (feed.account_id === accountId) {
      removedFeedIds.add(feed.id);
    }
  }
  const removedArticleIds = new Set<string>();
  for (const article of mockArticles) {
    if (removedFeedIds.has(article.feed_id)) {
      removedArticleIds.add(article.id);
    }
  }
  for (let i = mockFolders.length - 1; i >= 0; i -= 1) {
    if (mockFolders[i]?.account_id === accountId) {
      mockFolders.splice(i, 1);
    }
  }
  for (let i = mockFeeds.length - 1; i >= 0; i -= 1) {
    if (mockFeeds[i]?.account_id === accountId) {
      mockFeeds.splice(i, 1);
    }
  }
  for (let i = mockArticles.length - 1; i >= 0; i -= 1) {
    if (removedFeedIds.has(mockArticles[i]?.feed_id ?? "")) {
      mockArticles.splice(i, 1);
    }
  }
  for (let i = mockArticleTags.length - 1; i >= 0; i -= 1) {
    if (removedArticleIds.has(mockArticleTags[i]?.article_id ?? "")) {
      mockArticleTags.splice(i, 1);
    }
  }
  for (let i = mockArticleViewHistory.length - 1; i >= 0; i -= 1) {
    if (mockArticleViewHistory[i]?.accountId === accountId) {
      mockArticleViewHistory.splice(i, 1);
    }
  }
}
