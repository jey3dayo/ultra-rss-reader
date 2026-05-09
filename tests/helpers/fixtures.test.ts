import type { Result } from "@praha/byethrow";
import { createElement } from "react";
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
  createSampleAccounts,
  createSampleArticles,
  createSampleFeeds,
  createSampleFolders,
  createSampleMuteKeywords,
  createSampleTags,
  cloneFixtureSeed,
  type MutableTestFixture,
  type ReadonlyFixtureSeed,
  sampleAccountSeeds,
  sampleAccounts,
  sampleArticleSeeds,
  sampleArticles,
  sampleFeedSeeds,
  sampleFeeds,
  sampleFolderSeeds,
  sampleFolders,
  sampleMuteKeywordSeeds,
  sampleMuteKeywords,
  sampleTagSeeds,
  sampleTags,
} from "./fixtures";
import {
  renderStory,
  type StoryDecorator,
  type StoryMeta,
} from "./render-story";

type CommandSuccess<TCommand> = TCommand extends (
  ...args: infer _Args
) => Result.ResultAsync<infer Output, unknown>
  ? Output
  : never;

function expectUniqueIds(items: readonly { id: string }[]) {
  const ids = items.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe("test fixtures", () => {
  it("keeps sample entity ids unique within each collection", () => {
    expectUniqueIds(sampleAccounts);
    expectUniqueIds(sampleFeeds);
    expectUniqueIds(sampleArticles);
    expectUniqueIds(sampleMuteKeywords);
    expectUniqueIds(sampleTags);
  });

  it("keeps feed and article references internally consistent", () => {
    const accountIds = new Set(sampleAccounts.map((account) => account.id));
    const feedIds = new Set(sampleFeeds.map((feed) => feed.id));

    expect(sampleFeeds.every((feed) => accountIds.has(feed.account_id))).toBe(
      true,
    );
    expect(
      sampleArticles.every((article) => feedIds.has(article.feed_id)),
    ).toBe(true);
  });

  it("keeps sample feed folder references resolvable within the same account", () => {
    const accountsById = new Map(
      sampleAccounts.map((account) => [account.id, account]),
    );
    const foldersById = new Map(
      sampleFolders.map((folder) => [folder.id, folder]),
    );
    const folderedFeeds = sampleFeeds.filter((feed) => feed.folder_id !== null);

    expect(folderedFeeds.length).toBeGreaterThan(0);

    for (const feed of folderedFeeds) {
      const folder = foldersById.get(feed.folder_id ?? "");
      expect(
        folder,
        `Missing folder ${feed.folder_id} for feed ${feed.id}`,
      ).toBeDefined();
      expect(
        folder?.account_id,
        `Folder ${feed.folder_id} belongs to a different account`,
      ).toBe(feed.account_id);
      const account = accountsById.get(feed.account_id);
      expect(
        account,
        `Missing account ${feed.account_id} for feed ${feed.id}`,
      ).toBeDefined();
      expect(
        account?.capabilities?.supports_folders,
        `Feed ${feed.id} uses a folder on an account without folder support`,
      ).toBe(true);
    }
  });

  it("keeps sample article to feed to account references resolvable", () => {
    const accountsById = new Map(
      sampleAccounts.map((account) => [account.id, account]),
    );
    const feedsById = new Map(sampleFeeds.map((feed) => [feed.id, feed]));

    for (const article of sampleArticles) {
      const feed = feedsById.get(article.feed_id);
      expect(
        feed,
        `Missing feed ${article.feed_id} for article ${article.id}`,
      ).toBeDefined();
      expect(
        accountsById.has(feed?.account_id ?? ""),
        `Missing account for article ${article.id}`,
      ).toBe(true);
    }
  });

  it("keeps sample account, feed, article, mute keyword, and tag fixtures compatible with DTO schemas", () => {
    expect(
      sampleAccounts.map((account) => AccountDtoSchema.parse(account)),
    ).toEqual(sampleAccounts);
    expect(
      sampleFolders.map((folder) => FolderDtoSchema.parse(folder)),
    ).toEqual(sampleFolders);
    expect(sampleFeeds.map((feed) => FeedDtoSchema.parse(feed))).toEqual(
      sampleFeeds,
    );
    expect(
      sampleArticles.map((article) => ArticleDtoSchema.parse(article)),
    ).toEqual(sampleArticles);
    expect(
      sampleMuteKeywords.map((keyword) => MuteKeywordDtoSchema.parse(keyword)),
    ).toEqual(sampleMuteKeywords);
    expect(sampleTags.map((tag) => TagDtoSchema.parse(tag))).toEqual(
      sampleTags,
    );
  });

  it("keeps required fixture display fields populated", () => {
    expect(
      sampleAccounts.every((account) => account.name.trim().length > 0),
    ).toBe(true);
    expect(
      sampleFeeds.every(
        (feed) => feed.title.trim().length > 0 && feed.url.trim().length > 0,
      ),
    ).toBe(true);
    expect(
      sampleArticles.every(
        (article) =>
          article.title.trim().length > 0 &&
          (article.url === null || article.url.trim().length > 0),
      ),
    ).toBe(true);
    expect(sampleTags.every((tag) => tag.name.trim().length > 0)).toBe(true);
  });

  it("builds fresh account, feed, and article fixture clones", () => {
    const accounts = createSampleAccounts();
    const feeds = createSampleFeeds();
    const folders = createSampleFolders();
    const articles = createSampleArticles();
    const muteKeywords = createSampleMuteKeywords();
    const tags = createSampleTags();

    expect(accounts).toEqual(sampleAccounts);
    expect(feeds).toEqual(sampleFeeds);
    expect(folders).toEqual(sampleFolders);
    expect(articles).toEqual(sampleArticles);
    expect(muteKeywords).toEqual(sampleMuteKeywords);
    expect(tags).toEqual(sampleTags);
    expect(accounts).not.toBe(sampleAccounts);
    expect(accounts[0]).not.toBe(sampleAccounts[0]);
    expect(accounts[0]?.capabilities).not.toBe(sampleAccounts[0]?.capabilities);
    expect(feeds[0]).not.toBe(sampleFeeds[0]);
    expect(folders[0]).not.toBe(sampleFolders[0]);
    expect(articles[0]).not.toBe(sampleArticles[0]);
    expect(muteKeywords[0]).not.toBe(sampleMuteKeywords[0]);
    expect(tags[0]).not.toBe(sampleTags[0]);
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

  it("exposes readonly seeds and mutable clone helpers at the type boundary", () => {
    expectTypeOf(sampleAccounts).toEqualTypeOf<
      CommandSuccess<typeof listAccounts>
    >();
    expectTypeOf(sampleFolders).toEqualTypeOf<
      CommandSuccess<typeof listFolders>
    >();
    expectTypeOf(sampleFeeds).toEqualTypeOf<CommandSuccess<typeof listFeeds>>();
    expectTypeOf(sampleArticles).toEqualTypeOf<
      CommandSuccess<typeof listArticles>
    >();
    expectTypeOf(sampleMuteKeywords).toEqualTypeOf<
      CommandSuccess<typeof listMuteKeywords>
    >();
    expectTypeOf(sampleTags).toEqualTypeOf<CommandSuccess<typeof listTags>>();
    expectTypeOf(sampleAccountSeeds).toEqualTypeOf<
      ReadonlyFixtureSeed<AccountDto>
    >();
    expectTypeOf(sampleFolderSeeds).toEqualTypeOf<
      ReadonlyFixtureSeed<FolderDto>
    >();
    expectTypeOf(sampleFeedSeeds).toEqualTypeOf<ReadonlyFixtureSeed<FeedDto>>();
    expectTypeOf(sampleArticleSeeds).toEqualTypeOf<
      ReadonlyFixtureSeed<ArticleDto>
    >();
    expectTypeOf(sampleMuteKeywordSeeds).toEqualTypeOf<
      ReadonlyFixtureSeed<MuteKeywordDto>
    >();
    expectTypeOf(sampleTagSeeds).toEqualTypeOf<ReadonlyFixtureSeed<TagDto>>();
    expectTypeOf(sampleAccounts).toEqualTypeOf<
      MutableTestFixture<AccountDto>
    >();
    expectTypeOf(sampleFolders).toEqualTypeOf<MutableTestFixture<FolderDto>>();
    expectTypeOf(sampleFeeds).toEqualTypeOf<MutableTestFixture<FeedDto>>();
    expectTypeOf(sampleArticles).toEqualTypeOf<
      MutableTestFixture<ArticleDto>
    >();
    expectTypeOf(sampleMuteKeywords).toEqualTypeOf<
      MutableTestFixture<MuteKeywordDto>
    >();
    expectTypeOf(sampleTags).toEqualTypeOf<MutableTestFixture<TagDto>>();
    expectTypeOf(cloneFixtureSeed(sampleAccountSeeds)).toEqualTypeOf<
      MutableTestFixture<AccountDto>
    >();
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
    expectTypeOf(createSampleAccounts()).toEqualTypeOf<
      MutableTestFixture<AccountDto>
    >();
    expectTypeOf(createSampleFolders()).toEqualTypeOf<
      MutableTestFixture<FolderDto>
    >();
    expectTypeOf(createSampleFeeds()).toEqualTypeOf<
      MutableTestFixture<FeedDto>
    >();
    expectTypeOf(createSampleArticles()).toEqualTypeOf<
      MutableTestFixture<ArticleDto>
    >();
    expectTypeOf(createSampleMuteKeywords()).toEqualTypeOf<
      MutableTestFixture<MuteKeywordDto>
    >();
    expectTypeOf(createSampleTags()).toEqualTypeOf<
      MutableTestFixture<TagDto>
    >();

    if (Date.now() < 0) {
      const seedAccount = sampleAccountSeeds[0];
      if (seedAccount?.capabilities) {
        // @ts-expect-error seed fixtures are readonly; use createSampleAccounts() for mutable test state.
        seedAccount.name = "Direct Seed Mutation";
        // @ts-expect-error nested seed fixture fields are readonly as part of the fixture seed contract.
        seedAccount.capabilities.supports_search = true;
      }
      // @ts-expect-error seed fixture collections are readonly; clone helpers return mutable arrays.
      sampleAccountSeeds.push(...createSampleAccounts());
      const mutableAccounts = createSampleAccounts();
      const mutableAccount = mutableAccounts[0];
      if (mutableAccount?.capabilities) {
        mutableAccount.name = "Mutable Clone";
        mutableAccount.capabilities.supports_search = true;
      }
      mutableAccounts.push(...createSampleAccounts());
    }

    expect(createSampleAccounts()).toEqual(sampleAccounts);
  });
});

describe("renderStory", () => {
  it("merges args, parameters, globals, and decorators for render and decorator contexts", () => {
    const calls: string[] = [];
    const snapshots: Array<{
      source: string;
      args: { label: string; tone: string };
      parameters: Record<string, unknown>;
      globals: Record<string, unknown>;
    }> = [];
    const capture =
      (source: string): StoryDecorator<{ label: string; tone: string }> =>
      (Story, context) => {
        calls.push(source);
        snapshots.push({
          source,
          args: context.args,
          parameters: context.parameters,
          globals: context.globals,
        });
        return Story();
      };

    const meta = {
      component: ({ label }: { label: string; tone: string }) =>
        createElement("span", null, label),
      args: { label: "meta", tone: "neutral" },
      parameters: { layout: "centered", viewport: "desktop" },
      globals: { locale: "en", theme: "light" },
      render: (args, context) => {
        calls.push("render");
        snapshots.push({
          source: "render",
          args,
          parameters: context.parameters,
          globals: context.globals,
        });
        return createElement("span", null, `${args.label}:${args.tone}`);
      },
      decorators: capture("meta"),
    } satisfies StoryMeta<{ label: string; tone: string }>;

    renderStory<{ label: string; tone: string }>(meta, {
      args: { label: "story" },
      parameters: { viewport: "mobile" },
      globals: { theme: "dark" },
      decorators: [undefined, capture("story"), null],
    });

    expect(calls).toEqual(["meta", "story", "render"]);
    expect(snapshots).toEqual([
      {
        source: "meta",
        args: { label: "story", tone: "neutral" },
        parameters: { layout: "centered", viewport: "mobile" },
        globals: { locale: "en", theme: "dark" },
      },
      {
        source: "story",
        args: { label: "story", tone: "neutral" },
        parameters: { layout: "centered", viewport: "mobile" },
        globals: { locale: "en", theme: "dark" },
      },
      {
        source: "render",
        args: { label: "story", tone: "neutral" },
        parameters: { layout: "centered", viewport: "mobile" },
        globals: { locale: "en", theme: "dark" },
      },
    ]);
  });

  it("passes composed parameters and globals into decorator context", () => {
    const contexts: Array<{
      parameters: Record<string, unknown>;
      globals: Record<string, unknown>;
    }> = [];
    const decorator: StoryDecorator<{ label: string }> = (Story, context) => {
      contexts.push({
        parameters: context.parameters,
        globals: context.globals,
      });
      return Story();
    };

    renderStory(
      {
        component: ({ label }: { label: string }) =>
          createElement("span", null, label),
        args: { label: "base" },
        parameters: { layout: "centered", viewport: "desktop" },
        globals: { locale: "en", theme: "light" },
        decorators: [decorator],
      },
      {
        args: { label: "story" },
        parameters: { viewport: "mobile" },
        globals: { theme: "dark" },
      },
    );

    expect(contexts).toEqual([
      {
        parameters: { layout: "centered", viewport: "mobile" },
        globals: { locale: "en", theme: "dark" },
      },
    ]);
  });

  it("applies meta decorators outside story decorators with merged story args", () => {
    const calls: string[] = [];
    const contexts: Array<{ label: string }> = [];
    const createDecorator =
      (name: string): StoryDecorator<{ label: string }> =>
      (Story, context) => {
        calls.push(`${name}:before`);
        contexts.push({ label: context.args.label });
        const output = Story();
        calls.push(`${name}:after`);
        return createElement("div", { "data-decorator": name }, output);
      };

    const { container } = renderStory(
      {
        component: ({ label }: { label: string }) => {
          calls.push(`component:${label}`);
          return createElement("span", null, label);
        },
        args: { label: "meta" },
        decorators: [
          createDecorator("meta-outer"),
          createDecorator("meta-inner"),
        ],
      },
      {
        args: { label: "story" },
        decorators: [
          createDecorator("story-outer"),
          createDecorator("story-inner"),
        ],
      },
    );

    expect(calls).toEqual([
      "meta-outer:before",
      "meta-inner:before",
      "story-outer:before",
      "story-inner:before",
      "story-inner:after",
      "story-outer:after",
      "meta-inner:after",
      "meta-outer:after",
      "component:story",
    ]);
    expect(contexts).toEqual([
      { label: "story" },
      { label: "story" },
      { label: "story" },
      { label: "story" },
    ]);
    expect(
      Array.from(container.querySelectorAll("[data-decorator]")).map((node) =>
        node.getAttribute("data-decorator"),
      ),
    ).toEqual(["meta-outer", "meta-inner", "story-outer", "story-inner"]);
  });

  it("rejects non-options values passed as the third argument", () => {
    const meta = {
      component: ({ label }: { label: string }) =>
        createElement("span", null, label),
      args: { label: "base" },
    };

    expect(() =>
      renderStory(
        meta,
        {
          args: { label: "story" },
        },
        // @ts-expect-error This fixes the runtime boundary for JS or incorrectly typed callers.
        true,
      ),
    ).toThrowError(
      "renderStory third argument must be Testing Library RenderOptions.",
    );
  });

  it("passes valid Testing Library options through to render", () => {
    const wrapperText = "render wrapper";
    const { baseElement } = renderStory(
      {
        component: ({ label }: { label: string }) =>
          createElement("span", null, label),
        args: { label: "base" },
      },
      {
        args: { label: "story" },
      },
      {
        baseElement: document.createElement("section"),
        wrapper: ({ children }) =>
          createElement("div", { "aria-label": wrapperText }, children),
      },
    );

    expect(baseElement.tagName).toBe("SECTION");
    expect(
      baseElement.querySelector(`[aria-label="${wrapperText}"]`),
    ).not.toBeNull();
    expect(baseElement).toHaveTextContent("story");
  });
});
