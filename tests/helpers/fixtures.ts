import type { AccountDto, ArticleDto, FeedDto, MuteKeywordDto, TagDto } from "@/api/tauri-commands";

export const sampleAccounts: AccountDto[] = [
  {
    id: "acc-1",
    kind: "local",
    name: "Local",
    username: null,
    server_url: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    kind: "freshrss",
    name: "FreshRSS",
    username: "user",
    server_url: "https://freshrss.example.com",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

export const sampleFeeds: FeedDto[] = [
  {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: null,
    title: "Tech Blog",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 5,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: null,
    title: "News",
    url: "https://example.com/news.xml",
    site_url: "https://example.com",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
];

export const sampleArticles: ArticleDto[] = [
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

export const sampleMuteKeywords: MuteKeywordDto[] = [
  {
    id: "mute-1",
    keyword: "Kindle Unlimited",
    scope: "title_and_body",
    created_at: "2026-04-15T01:00:00Z",
    updated_at: "2026-04-15T01:00:00Z",
  },
];

export const sampleTags: TagDto[] = [
  {
    id: "tag-1",
    name: "Tech",
    color: "#6f8eb8",
  },
  {
    id: "tag-2",
    name: "Later",
    color: null,
  },
];
