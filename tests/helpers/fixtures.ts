import type { Result } from "@praha/byethrow";
import type {
  listAccounts,
  listArticles,
  listFeeds,
  listFolders,
  listMuteKeywords,
  listTags,
} from "@/api/tauri-commands";

type CommandSuccess<TCommand> = TCommand extends (...args: infer _Args) => Result.ResultAsync<infer Output, unknown>
  ? Output
  : never;
type CommandListItem<TCommand> = CommandSuccess<TCommand> extends readonly (infer Item)[] ? Item : never;

type AccountFixture = CommandListItem<typeof listAccounts>;
type FolderFixture = CommandListItem<typeof listFolders>;
type FeedFixture = CommandListItem<typeof listFeeds>;
type ArticleFixture = CommandListItem<typeof listArticles>;
type MuteKeywordFixture = CommandListItem<typeof listMuteKeywords>;
type TagFixture = CommandListItem<typeof listTags>;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlyFixtureSeed<T> = readonly DeepReadonly<T>[];
export type MutableTestFixture<T> = T[];

export const sampleAccountSeeds: ReadonlyFixtureSeed<AccountFixture> = [
  {
    id: "acc-1",
    kind: "local",
    name: "Local",
    display_name: "Local",
    icon_url: null,
    capabilities: {
      supports_folders: false,
      supports_starring: false,
      supports_search: false,
      supports_delta_sync: false,
      supports_remote_state: false,
    },
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
    display_name: "FreshRSS",
    icon_url: null,
    capabilities: {
      supports_folders: true,
      supports_starring: true,
      supports_search: true,
      supports_delta_sync: true,
      supports_remote_state: true,
    },
    username: "user",
    server_url: "https://freshrss.example.com",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

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

export const sampleMuteKeywordSeeds: ReadonlyFixtureSeed<MuteKeywordFixture> = [
  {
    id: "mute-1",
    keyword: "Kindle Unlimited",
    scope: "title_and_body",
    created_at: "2026-04-15T01:00:00Z",
    updated_at: "2026-04-15T01:00:00Z",
  },
];

export const sampleTagSeeds: ReadonlyFixtureSeed<TagFixture> = [
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

function cloneFixture<T>(fixture: ReadonlyFixtureSeed<T>): MutableTestFixture<T> {
  return structuredClone(fixture) as MutableTestFixture<T>;
}

export const sampleAccounts = cloneFixture(sampleAccountSeeds);
export const sampleFolders = cloneFixture(sampleFolderSeeds);
export const sampleFeeds = cloneFixture(sampleFeedSeeds);
export const sampleArticles = cloneFixture(sampleArticleSeeds);
export const sampleMuteKeywords = cloneFixture(sampleMuteKeywordSeeds);
export const sampleTags = cloneFixture(sampleTagSeeds);

export function createSampleAccounts(): MutableTestFixture<AccountFixture> {
  return cloneFixture(sampleAccountSeeds);
}

export function createSampleFeeds(): MutableTestFixture<FeedFixture> {
  return cloneFixture(sampleFeedSeeds);
}

export function createSampleFolders(): MutableTestFixture<FolderFixture> {
  return cloneFixture(sampleFolderSeeds);
}

export function createSampleArticles(): MutableTestFixture<ArticleFixture> {
  return cloneFixture(sampleArticleSeeds);
}

export function createSampleMuteKeywords(): MutableTestFixture<MuteKeywordFixture> {
  return cloneFixture(sampleMuteKeywordSeeds);
}

export function createSampleTags(): MutableTestFixture<TagFixture> {
  return cloneFixture(sampleTagSeeds);
}
