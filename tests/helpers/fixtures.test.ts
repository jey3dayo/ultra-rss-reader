import type { Result } from "@praha/byethrow";
import { parse } from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  AccountDtoSchema,
  ArticleDtoSchema,
  FeedDtoSchema,
  FolderDtoSchema,
  MuteKeywordDtoSchema,
  TagDtoSchema,
} from "@/api/schemas";
import type {
  AccountDto,
  ArticleDto,
  FeedDto,
  FolderDto,
  listAccounts,
  listArticles,
  listFeeds,
  listFolders,
  listMuteKeywords,
  listTags,
  MuteKeywordDto,
  TagDto,
} from "@/api/tauri-commands";
import {
  buildArticleTagFixtures,
  cloneFixtureSeed,
  createSampleAccounts,
  createSampleArticles,
  createSampleArticleTags,
  createSampleFeeds,
  createSampleFolders,
  createSampleMuteKeywords,
  createSampleTags,
  type MutableTestFixture,
  type ReadonlyFixtureSeed,
  requireSampleArticle,
  requireSampleFeed,
  sampleAccountSeeds,
  sampleAccounts,
  sampleArticleSeeds,
  sampleArticles,
  sampleArticleTagSeeds,
  sampleArticleTags,
  sampleFeedSeeds,
  sampleFeeds,
  sampleFolderSeeds,
  sampleFolders,
  sampleMuteKeywordSeeds,
  sampleMuteKeywords,
  sampleTagSeeds,
  sampleTags,
} from "./fixtures";

type CommandSuccess<TCommand> = TCommand extends (...args: infer _Args) => Result.ResultAsync<infer Output, unknown>
  ? Output
  : never;

function expectUniqueIds(items: readonly { id: string }[]) {
  const ids = items.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
}

function expectNonBlank(value: string | null | undefined, message: string) {
  expect(value?.trim().length ?? 0, message).toBeGreaterThan(0);
}

describe("test fixtures", () => {
  it("keeps sample entity ids unique within each collection", () => {
    expectUniqueIds(sampleAccounts);
    expectUniqueIds(sampleFeeds);
    expectUniqueIds(sampleArticles);
    expectUniqueIds(sampleMuteKeywords);
    expectUniqueIds(sampleTags);
  });

  it("keeps sample article, feed, account, and tag references internally consistent", () => {
    const accountIds = new Set(sampleAccounts.map((account) => account.id));
    const feedIds = new Set(sampleFeeds.map((feed) => feed.id));
    const articleIds = new Set(sampleArticles.map((article) => article.id));
    const tagIds = new Set(sampleTags.map((tag) => tag.id));

    expect(sampleFeeds.every((feed) => accountIds.has(feed.account_id))).toBe(true);
    expect(sampleArticles.every((article) => feedIds.has(article.feed_id))).toBe(true);
    expect(sampleArticleTags.every((articleTag) => articleIds.has(articleTag.article_id))).toBe(true);
    expect(sampleArticleTags.every((articleTag) => tagIds.has(articleTag.tag_id))).toBe(true);
  });

  it("deduplicates article-tag pairs and drops orphan article/tag relations while preserving stable order", () => {
    const articleTags = buildArticleTagFixtures({
      articleTags: [
        { article_id: "art-2", tag_id: "tag-2" },
        { article_id: "art-2", tag_id: "tag-2" },
        { article_id: "missing-article", tag_id: "tag-1" },
        { article_id: "art-1", tag_id: "missing-tag" },
        { article_id: "art-1", tag_id: "tag-1" },
      ],
      articles: sampleArticles,
      tags: sampleTags,
    });

    expect(articleTags).toEqual([
      { article_id: "art-2", tag_id: "tag-2" },
      { article_id: "art-1", tag_id: "tag-1" },
    ]);
  });

  it("keeps sample article-tag builders aligned with the relation cleanup invariant", () => {
    expect(createSampleArticleTags()).toEqual(
      buildArticleTagFixtures({
        articleTags: sampleArticleTagSeeds,
        articles: sampleArticles,
        tags: sampleTags,
      }),
    );
  });

  it("keeps sample feed folder references resolvable within the same account", () => {
    const accountsById = new Map(sampleAccounts.map((account) => [account.id, account]));
    const foldersById = new Map(sampleFolders.map((folder) => [folder.id, folder]));
    const folderedFeeds = sampleFeeds.filter((feed) => feed.folder_id !== null);
    const folderCapableFeeds = sampleFeeds.filter(
      (feed) => accountsById.get(feed.account_id)?.capabilities?.supports_folders === true,
    );

    expect(folderedFeeds.length).toBeGreaterThan(0);
    expect(folderCapableFeeds.some((feed) => feed.folder_id !== null)).toBe(true);
    expect(folderCapableFeeds.some((feed) => feed.folder_id === null)).toBe(true);

    for (const feed of folderedFeeds) {
      const folder = foldersById.get(feed.folder_id ?? "");
      expect(folder, `Missing folder ${feed.folder_id} for feed ${feed.id}`).toBeDefined();
      expect(folder?.account_id, `Folder ${feed.folder_id} belongs to a different account`).toBe(feed.account_id);
      const account = accountsById.get(feed.account_id);
      expect(account, `Missing account ${feed.account_id} for feed ${feed.id}`).toBeDefined();
      expect(
        account?.capabilities?.supports_folders,
        `Feed ${feed.id} uses a folder on an account without folder support`,
      ).toBe(true);
    }
  });

  it("keeps sample article to feed to account references resolvable", () => {
    const accountsById = new Map(sampleAccounts.map((account) => [account.id, account]));
    const feedsById = new Map(sampleFeeds.map((feed) => [feed.id, feed]));

    for (const article of sampleArticles) {
      const feed = feedsById.get(article.feed_id);
      expect(feed, `Missing feed ${article.feed_id} for article ${article.id}`).toBeDefined();
      expect(accountsById.has(feed?.account_id ?? ""), `Missing account for article ${article.id}`).toBe(true);
    }
  });

  it("covers reader articles across local, cross-account, foldered, and tagged sample scopes", () => {
    const feedsById = new Map(sampleFeeds.map((feed) => [feed.id, feed]));
    const foldersById = new Map(sampleFolders.map((folder) => [folder.id, folder]));
    const articleTagsByArticleId = new Map<string, string[]>();

    for (const articleTag of sampleArticleTags) {
      articleTagsByArticleId.set(articleTag.article_id, [
        ...(articleTagsByArticleId.get(articleTag.article_id) ?? []),
        articleTag.tag_id,
      ]);
    }

    const accountIdsWithArticles = new Set(
      sampleArticles.map((article) => feedsById.get(article.feed_id)?.account_id).filter((accountId) => accountId),
    );
    const folderedArticles = sampleArticles.filter((article) => {
      const feed = feedsById.get(article.feed_id);
      return feed?.folder_id !== null && foldersById.get(feed?.folder_id ?? "")?.account_id === feed?.account_id;
    });
    const taggedArticleIds = new Set(sampleArticleTags.map((articleTag) => articleTag.article_id));

    expect(accountIdsWithArticles).toEqual(new Set(sampleAccounts.map((account) => account.id)));
    expect(folderedArticles.map((article) => article.id)).toContain("art-3");
    expect(sampleArticles.every((article) => taggedArticleIds.has(article.id))).toBe(true);
    expect(articleTagsByArticleId.get("art-3")).toEqual(["tag-1"]);
    expect(articleTagsByArticleId.get("art-4")).toEqual(["tag-2"]);
  });

  it("keeps sample account, feed, article, mute keyword, and tag fixtures compatible with DTO schemas", () => {
    expect(sampleAccounts.map((account) => parse(AccountDtoSchema, account))).toEqual(sampleAccounts);
    expect(sampleFolders.map((folder) => parse(FolderDtoSchema, folder))).toEqual(sampleFolders);
    expect(sampleFeeds.map((feed) => parse(FeedDtoSchema, feed))).toEqual(sampleFeeds);
    expect(sampleArticles.map((article) => parse(ArticleDtoSchema, article))).toEqual(sampleArticles);
    expect(sampleMuteKeywords.map((keyword) => parse(MuteKeywordDtoSchema, keyword))).toEqual(sampleMuteKeywords);
    expect(sampleTags.map((tag) => parse(TagDtoSchema, tag))).toEqual(sampleTags);
  });

  it("keeps required fixture identity and display fields populated", () => {
    for (const account of sampleAccounts) {
      expectNonBlank(account.id, "account id is required");
      expectNonBlank(account.name, `account ${account.id} name is required`);
      expectNonBlank(account.display_name, `account ${account.id} display_name is required`);
    }
    for (const feed of sampleFeeds) {
      expectNonBlank(feed.id, "feed id is required");
      expectNonBlank(feed.account_id, `feed ${feed.id} account_id is required`);
      expectNonBlank(feed.title, `feed ${feed.id} title is required`);
      expectNonBlank(feed.url, `feed ${feed.id} url is required`);
    }
    for (const article of sampleArticles) {
      expectNonBlank(article.id, "article id is required");
      expectNonBlank(article.feed_id, `article ${article.id} feed_id is required`);
      expectNonBlank(article.title, `article ${article.id} title is required`);
      if (article.url !== null) {
        expectNonBlank(article.url, `article ${article.id} url is required`);
      }
      expectNonBlank(article.published_at, `article ${article.id} published_at is required`);
    }
    for (const tag of sampleTags) {
      expectNonBlank(tag.id, "tag id is required");
      expectNonBlank(tag.name, `tag ${tag.id} name is required`);
    }
    for (const articleTag of sampleArticleTags) {
      expectNonBlank(articleTag.article_id, "article tag article_id is required");
      expectNonBlank(articleTag.tag_id, "article tag tag_id is required");
    }
  });

  it("builds fresh account, feed, and article fixture clones", () => {
    const accounts = createSampleAccounts();
    const feeds = createSampleFeeds();
    const folders = createSampleFolders();
    const articles = createSampleArticles();
    const articleTags = createSampleArticleTags();
    const muteKeywords = createSampleMuteKeywords();
    const tags = createSampleTags();

    expect(accounts).toEqual(sampleAccounts);
    expect(feeds).toEqual(sampleFeeds);
    expect(folders).toEqual(sampleFolders);
    expect(articles).toEqual(sampleArticles);
    expect(articleTags).toEqual(sampleArticleTags);
    expect(muteKeywords).toEqual(sampleMuteKeywords);
    expect(tags).toEqual(sampleTags);
    expect(accounts).not.toBe(sampleAccounts);
    expect(accounts[0]).not.toBe(sampleAccounts[0]);
    expect(accounts[0]?.capabilities).not.toBe(sampleAccounts[0]?.capabilities);
    expect(feeds[0]).not.toBe(sampleFeeds[0]);
    expect(folders[0]).not.toBe(sampleFolders[0]);
    expect(articles[0]).not.toBe(sampleArticles[0]);
    expect(articleTags[0]).not.toBe(sampleArticleTags[0]);
    expect(muteKeywords[0]).not.toBe(sampleMuteKeywords[0]);
    expect(tags[0]).not.toBe(sampleTags[0]);
  });

  it("reports missing reader fixtures with fixture id and owner file context", () => {
    expect(() => requireSampleFeed("missing-feed")).toThrow(
      "Expected sample feed fixture. fixture id: missing-feed; owner file: tests/helpers/reader-fixtures.ts",
    );
    expect(() => requireSampleArticle("missing-article")).toThrow(
      "Expected sample article fixture. fixture id: missing-article; owner file: tests/helpers/reader-fixtures.ts",
    );
  });

  it("keeps mutable clone edits isolated from readonly fixture seeds", () => {
    const accounts = createSampleAccounts();
    const feeds = createSampleFeeds();

    if (accounts[0]?.capabilities) {
      accounts[0].name = "Renamed Local";
      accounts[0].capabilities.supports_search = true;
    }
    if (feeds[0]) {
      feeds[0].title = "Renamed Feed";
    }

    expect(sampleAccountSeeds[0]?.name).toBe("Local");
    expect(sampleAccountSeeds[0]?.capabilities?.supports_search).toBe(false);
    expect(sampleFeedSeeds[0]?.title).toBe("Tech Blog");
    expect(sampleAccounts[0]?.name).toBe("Local");
    expect(sampleAccounts[0]?.capabilities?.supports_search).toBe(false);
    expect(sampleFeeds[0]?.title).toBe("Tech Blog");
  });

  it("rejects non JSON-like fixture seed values before cloning", () => {
    const dateSeed = [{ value: new Date("2026-01-01T00:00:00Z") }] as unknown as ReadonlyFixtureSeed<{
      value: string;
    }>;
    const mapSeed = [{ value: new Map([["key", "value"]]) }] as unknown as ReadonlyFixtureSeed<{
      value: string;
    }>;
    const functionSeed = [{ value: () => "value" }] as unknown as ReadonlyFixtureSeed<{ value: string }>;
    const undefinedSeed = [{ value: undefined }] as unknown as ReadonlyFixtureSeed<{ value: string }>;

    expect(() => cloneFixtureSeed(dateSeed)).toThrow(
      "Fixture seed must contain JSON-like values only. Unsupported Date at $[0].value",
    );
    expect(() => cloneFixtureSeed(mapSeed)).toThrow(
      "Fixture seed must contain JSON-like values only. Unsupported Map at $[0].value",
    );
    expect(() => cloneFixtureSeed(functionSeed)).toThrow(
      "Fixture seed must contain JSON-like values only. Unsupported function at $[0].value",
    );
    expect(() => cloneFixtureSeed(undefinedSeed)).toThrow(
      "Fixture seed must contain JSON-like values only. Unsupported undefined at $[0].value",
    );
  });

  it("allows JSON-like fixture seed values", () => {
    const seed: ReadonlyFixtureSeed<{
      id: string;
      enabled: boolean;
      count: number;
      label: string | null;
      nested: { items: readonly string[] };
    }> = [
      {
        id: "json-like",
        enabled: true,
        count: 1,
        label: null,
        nested: { items: ["one", "two"] },
      },
    ];

    expect(cloneFixtureSeed(seed)).toEqual(seed);
  });

  it("exposes readonly seeds and mutable clone helpers at the type boundary", () => {
    expectTypeOf(sampleAccounts).toEqualTypeOf<CommandSuccess<typeof listAccounts>>();
    expectTypeOf(sampleFolders).toEqualTypeOf<CommandSuccess<typeof listFolders>>();
    expectTypeOf(sampleFeeds).toEqualTypeOf<CommandSuccess<typeof listFeeds>>();
    expectTypeOf(sampleArticles).toEqualTypeOf<CommandSuccess<typeof listArticles>>();
    expectTypeOf(sampleMuteKeywords).toEqualTypeOf<CommandSuccess<typeof listMuteKeywords>>();
    expectTypeOf(sampleTags).toEqualTypeOf<CommandSuccess<typeof listTags>>();
    expectTypeOf(sampleAccountSeeds).toEqualTypeOf<ReadonlyFixtureSeed<AccountDto>>();
    expectTypeOf(sampleFolderSeeds).toEqualTypeOf<ReadonlyFixtureSeed<FolderDto>>();
    expectTypeOf(sampleFeedSeeds).toEqualTypeOf<ReadonlyFixtureSeed<FeedDto>>();
    expectTypeOf(sampleArticleSeeds).toEqualTypeOf<ReadonlyFixtureSeed<ArticleDto>>();
    expectTypeOf(sampleMuteKeywordSeeds).toEqualTypeOf<ReadonlyFixtureSeed<MuteKeywordDto>>();
    expectTypeOf(sampleTagSeeds).toEqualTypeOf<ReadonlyFixtureSeed<TagDto>>();
    expectTypeOf(sampleAccounts).toEqualTypeOf<MutableTestFixture<AccountDto>>();
    expectTypeOf(sampleFolders).toEqualTypeOf<MutableTestFixture<FolderDto>>();
    expectTypeOf(sampleFeeds).toEqualTypeOf<MutableTestFixture<FeedDto>>();
    expectTypeOf(sampleArticles).toEqualTypeOf<MutableTestFixture<ArticleDto>>();
    expectTypeOf(sampleMuteKeywords).toEqualTypeOf<MutableTestFixture<MuteKeywordDto>>();
    expectTypeOf(sampleTags).toEqualTypeOf<MutableTestFixture<TagDto>>();
    expectTypeOf(cloneFixtureSeed(sampleAccountSeeds)).toEqualTypeOf<MutableTestFixture<AccountDto>>();
    expectTypeOf<
      MutableTestFixture<{
        readonly id: string;
        readonly nested: { readonly enabled: boolean };
        readonly labels: readonly string[];
      }>
    >().toEqualTypeOf<
      Array<{
        id: string;
        nested: { enabled: boolean };
        labels: string[];
      }>
    >();
    expectTypeOf(createSampleAccounts()).toEqualTypeOf<MutableTestFixture<AccountDto>>();
    expectTypeOf(createSampleFolders()).toEqualTypeOf<MutableTestFixture<FolderDto>>();
    expectTypeOf(createSampleFeeds()).toEqualTypeOf<MutableTestFixture<FeedDto>>();
    expectTypeOf(createSampleArticles()).toEqualTypeOf<MutableTestFixture<ArticleDto>>();
    expectTypeOf(createSampleMuteKeywords()).toEqualTypeOf<MutableTestFixture<MuteKeywordDto>>();
    expectTypeOf(createSampleTags()).toEqualTypeOf<MutableTestFixture<TagDto>>();

    expect(createSampleAccounts()).toEqual(sampleAccounts);
  });
});
