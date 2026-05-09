import type { listArticles, listFeeds, listFolders, listTags } from "@/api/tauri-commands";
import {
  type CommandListItem,
  cloneFixtureSeed,
  type MutableTestFixture,
  type ReadonlyFixtureSeed,
} from "./fixture-types";

type FolderFixture = CommandListItem<typeof listFolders>;
type FeedFixture = CommandListItem<typeof listFeeds>;
type ArticleFixture = CommandListItem<typeof listArticles>;
type TagFixture = CommandListItem<typeof listTags>;
type ArticleTagFixture = {
  article_id: ArticleFixture["id"];
  tag_id: TagFixture["id"];
};

export const sampleFolderSeeds: ReadonlyFixtureSeed<FolderFixture> = [
  {
    id: "folder-1",
    account_id: "acc-2",
    name: "Reading",
    sort_order: 0,
  },
];

export const sampleFeedSeeds: ReadonlyFixtureSeed<FeedFixture> = [
  {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Tech Blog",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 5,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-2",
    account_id: "acc-2",
    folder_id: "folder-1",
    remote_id: null,
    title: "News",
    url: "https://example.com/news.xml",
    site_url: "https://example.com",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-3",
    account_id: "acc-2",
    folder_id: null,
    remote_id: null,
    title: "Fresh Inbox",
    url: "https://example.com/fresh.xml",
    site_url: "https://example.com/fresh",
    unread_count: 2,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
];

export const sampleArticleSeeds: ReadonlyFixtureSeed<ArticleFixture> = [
  {
    id: "art-1",
    feed_id: "feed-1",
    title: "First Article",
    content_sanitized: "<p>Hello world</p>",
    summary: "A hello world article",
    url: "https://example.com/1",
    author: "Alice",
    published_at: "2026-03-25T10:00:00Z",
    thumbnail: null,
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-2",
    feed_id: "feed-1",
    title: "Second Article",
    content_sanitized: "<p>Another post</p>",
    summary: null,
    url: "https://example.com/2",
    author: null,
    published_at: "2026-03-24T08:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: true,
  },
];

export const sampleArticleTagSeeds: ReadonlyFixtureSeed<ArticleTagFixture> = [
  {
    article_id: "art-1",
    tag_id: "tag-1",
  },
  {
    article_id: "art-2",
    tag_id: "tag-2",
  },
];

export const sampleFolders: MutableTestFixture<FolderFixture> = cloneFixtureSeed(sampleFolderSeeds);
export const sampleFeeds: MutableTestFixture<FeedFixture> = cloneFixtureSeed(sampleFeedSeeds);
export const sampleArticles: MutableTestFixture<ArticleFixture> = cloneFixtureSeed(sampleArticleSeeds);
export const sampleArticleTags: MutableTestFixture<ArticleTagFixture> = cloneFixtureSeed(sampleArticleTagSeeds);

export function createSampleFeeds(): MutableTestFixture<FeedFixture> {
  return cloneFixtureSeed(sampleFeedSeeds);
}

export function createSampleFolders(): MutableTestFixture<FolderFixture> {
  return cloneFixtureSeed(sampleFolderSeeds);
}

export function createSampleArticles(): MutableTestFixture<ArticleFixture> {
  return cloneFixtureSeed(sampleArticleSeeds);
}

export function createSampleArticleTags(): MutableTestFixture<ArticleTagFixture> {
  return cloneFixtureSeed(sampleArticleTagSeeds);
}

export function requireSampleFeed(feedId: FeedFixture["id"]): FeedFixture {
  const feed = sampleFeeds.find((sampleFeed) => sampleFeed.id === feedId);

  if (!feed) {
    throw new Error(`Expected sample feed fixture for ${feedId}`);
  }

  return feed;
}

export function requireSampleArticle(articleId: ArticleFixture["id"]): ArticleFixture {
  const article = sampleArticles.find((sampleArticle) => sampleArticle.id === articleId);

  if (!article) {
    throw new Error(`Expected sample article fixture for ${articleId}`);
  }

  return article;
}

export function requireSampleUnreadArticle(): ArticleFixture {
  const article = sampleArticles.find((sampleArticle) => !sampleArticle.is_read);

  if (!article) {
    throw new Error("Expected unread sample article fixture");
  }

  return article;
}

export function requireSampleReadArticle(): ArticleFixture {
  const article = sampleArticles.find((sampleArticle) => sampleArticle.is_read);

  if (!article) {
    throw new Error("Expected read sample article fixture");
  }

  return article;
}

export function requireSampleStarredArticle(): ArticleFixture {
  const article = sampleArticles.find((sampleArticle) => sampleArticle.is_starred);

  if (!article) {
    throw new Error("Expected starred sample article fixture");
  }

  return article;
}

export function collectFeedIdsByAccount(feeds: readonly FeedFixture[], accountId: string | undefined): Set<string> {
  const feedIds = new Set<string>();

  for (const feed of feeds) {
    if (feed.account_id === accountId) {
      feedIds.add(feed.id);
    }
  }

  return feedIds;
}

export function listArticlesByFeedId(
  articles: readonly ArticleFixture[],
  feedId: string | undefined,
): ArticleFixture[] {
  const selectedArticles: ArticleFixture[] = [];

  for (const article of articles) {
    if (article.feed_id === feedId) {
      selectedArticles.push(article);
    }
  }

  return selectedArticles;
}

export function listSampleFeedsByAccountId(accountId: string | undefined): FeedFixture[] {
  const selectedFeeds: FeedFixture[] = [];

  for (const feed of sampleFeeds) {
    if (feed.account_id === accountId) {
      selectedFeeds.push(feed);
    }
  }

  return selectedFeeds;
}

export function listSampleArticlesByFeedId(feedId: string | undefined): ArticleFixture[] {
  return listArticlesByFeedId(sampleArticles, feedId);
}

export function listSampleArticlesByAccountId(accountId: string | undefined): ArticleFixture[] {
  return listArticlesByAccountId({
    articles: sampleArticles,
    feeds: sampleFeeds,
    accountId,
  });
}

export function listSampleArticlesByTagId(tagId: TagFixture["id"] | undefined): ArticleFixture[] {
  const articleIds = new Set<string>();

  for (const articleTag of sampleArticleTags) {
    if (articleTag.tag_id === tagId) {
      articleIds.add(articleTag.article_id);
    }
  }

  const selectedArticles: ArticleFixture[] = [];

  for (const article of sampleArticles) {
    if (articleIds.has(article.id)) {
      selectedArticles.push(article);
    }
  }

  return selectedArticles;
}

export function listArticlesByAccountId({
  articles,
  feeds,
  accountId,
}: {
  articles: readonly ArticleFixture[];
  feeds: readonly FeedFixture[];
  accountId: string | undefined;
}): ArticleFixture[] {
  const feedIds = collectFeedIdsByAccount(feeds, accountId);
  const selectedArticles: ArticleFixture[] = [];

  for (const article of articles) {
    if (feedIds.has(article.feed_id)) {
      selectedArticles.push(article);
    }
  }

  return selectedArticles;
}
