import { parse } from "valibot";
import { describe, expect, it, vi } from "vitest";
import {
  createMuteKeywordArgs,
  createTagArgs,
  deleteMuteKeywordArgs,
  deleteTagArgs,
  getTagArticleCountsArgs,
  listArticlesByTagArgs,
  MuteKeywordDtoSchema,
  MuteKeywordScopeSchema,
  renameTagArgs,
  setMuteAutoMarkReadArgs,
  TagArticleCountsSchema,
  TagDtoSchema,
  updateMuteKeywordArgs,
} from "@/api/schemas";
import { MuteKeywordKeywordSchema } from "@/api/schemas/mute-keyword";
import {
  MUTE_KEYWORD_QUERY_KEY,
  resolveMuteKeywordInvalidationQueryKeys,
  useMuteKeywords,
} from "@/hooks/use-mute-keywords";
import { resolveTagMutationInvalidationQueryKeys } from "@/hooks/use-tags";
import { queryKeys } from "@/lib/query/query-invalidation";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn((options: { queryKey?: unknown }) => options),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: useQueryMock,
}));

describe("tag settings and reader tag contracts", () => {
  it("keeps create, rename, delete, and count command schemas scoped to tag payloads", () => {
    expect(parse(createTagArgs, { name: "Review", color: "#6f8eb8" })).toEqual({
      name: "Review",
      color: "#6f8eb8",
    });
    expect(parse(createTagArgs, { name: "Review" })).toEqual({ name: "Review" });
    expect(parse(renameTagArgs, { tagId: "tag-1", name: "Later", color: null })).toEqual({
      tagId: "tag-1",
      name: "Later",
      color: null,
    });
    expect(parse(deleteTagArgs, { tagId: "tag-1" })).toEqual({ tagId: "tag-1" });
    expect(parse(getTagArticleCountsArgs, { accountId: "acc-1" })).toEqual({
      accountId: "acc-1",
    });
    expect(
      parse(listArticlesByTagArgs, {
        tagId: "tag-1",
        accountId: "acc-1",
        mode: "unread",
      }),
    ).toEqual({
      tagId: "tag-1",
      accountId: "acc-1",
      mode: "unread",
    });

    expect(() => parse(createTagArgs, { name: "Review", color: null })).toThrow();
    expect(() => parse(renameTagArgs, { name: "Later" })).toThrow();
    expect(() => parse(deleteTagArgs, {})).toThrow();
  });

  it("keeps tag response schemas compatible with settings, reader tag list, and picker views", () => {
    expect(parse(TagDtoSchema, { id: "tag-1", name: "Review", color: null })).toEqual({
      id: "tag-1",
      name: "Review",
      color: null,
    });
    expect(parse(TagArticleCountsSchema, { "tag-1": 0, "tag-2": 3 })).toEqual({
      "tag-1": 0,
      "tag-2": 3,
    });

    expect(() => parse(TagArticleCountsSchema, { "tag-1": -1 })).toThrow();
  });

  it("keeps tag response names non-blank while preserving the nullable color contract", () => {
    expect(parse(TagDtoSchema, { id: "tag-1", name: "  Review  ", color: null })).toEqual({
      id: "tag-1",
      name: "Review",
      color: null,
    });
    expect(() => parse(TagDtoSchema, { id: "tag-1", name: "   ", color: null })).toThrow();
  });

  it("separates tag metadata and article assignment cache updates", () => {
    expect(resolveTagMutationInvalidationQueryKeys("create")).toEqual([["tags"]]);
    expect(resolveTagMutationInvalidationQueryKeys("articleAssignment")).toEqual([
      ["articleTags"],
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
    ]);
    expect(resolveTagMutationInvalidationQueryKeys("metadata")).toEqual([
      ["tags"],
      ["articleTags"],
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
    ]);
  });
});

describe("mute settings contracts", () => {
  it("keeps create, update, delete, and auto-mark command schemas scoped to mute keyword payloads", () => {
    expect(parse(createMuteKeywordArgs, { keyword: "spoiler", scope: "title" })).toEqual({
      keyword: "spoiler",
      scope: "title",
    });
    expect(parse(createMuteKeywordArgs, { keyword: " spoiler ", scope: "title" })).toEqual({
      keyword: "spoiler",
      scope: "title",
    });
    expect(
      parse(updateMuteKeywordArgs, {
        muteKeywordId: "mute-1",
        scope: "title_and_body",
      }),
    ).toEqual({
      muteKeywordId: "mute-1",
      scope: "title_and_body",
    });
    expect(parse(deleteMuteKeywordArgs, { muteKeywordId: "mute-1" })).toEqual({
      muteKeywordId: "mute-1",
    });
    expect(parse(setMuteAutoMarkReadArgs, { enabled: true })).toEqual({
      enabled: true,
    });

    expect(() => parse(createMuteKeywordArgs, { keyword: "spoiler", scope: "all" })).toThrow();
    expect(() => parse(createMuteKeywordArgs, { keyword: "", scope: "title" })).toThrow();
    expect(() => parse(createMuteKeywordArgs, { keyword: "   ", scope: "title" })).toThrow();
    expect(() => parse(updateMuteKeywordArgs, { muteKeywordId: "mute-1", scope: "all" })).toThrow();
    expect(() => parse(deleteMuteKeywordArgs, {})).toThrow();
  });

  it("keeps mute keyword text validation aligned with app input trimming", () => {
    expect(parse(MuteKeywordKeywordSchema, "  spoiler  ")).toBe("spoiler");
    expect(parse(MuteKeywordKeywordSchema, " セール告知 ")).toBe("セール告知");

    expect(() => parse(MuteKeywordKeywordSchema, "AI")).toThrow();
    expect(() => parse(MuteKeywordKeywordSchema, " あ ")).toThrow();
    expect(() => parse(MuteKeywordKeywordSchema, "   ")).toThrow();
  });

  it("keeps mute keyword response schemas independent from tag visual contracts", () => {
    expect(parse(MuteKeywordScopeSchema, "body")).toBe("body");
    expect(MuteKeywordScopeSchema.options).toEqual(["title", "body", "title_and_body"]);
    expect(
      parse(MuteKeywordDtoSchema, {
        id: "mute-1",
        keyword: "spoiler",
        scope: "title_and_body",
        created_at: "2026-05-09T00:00:00Z",
        updated_at: "2026-05-09T00:05:00Z",
      }),
    ).toEqual({
      id: "mute-1",
      keyword: "spoiler",
      scope: "title_and_body",
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:05:00Z",
    });
  });

  it("keeps mute keyword response text non-blank and trims backend payloads", () => {
    expect(
      parse(MuteKeywordDtoSchema, {
        id: "mute-1",
        keyword: "  spoiler  ",
        scope: "title",
        created_at: "2026-05-09T00:00:00Z",
        updated_at: "2026-05-09T00:05:00Z",
      }),
    ).toEqual({
      id: "mute-1",
      keyword: "spoiler",
      scope: "title",
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:05:00Z",
    });
    expect(() =>
      parse(MuteKeywordDtoSchema, {
        id: "mute-1",
        keyword: "   ",
        scope: "title",
        created_at: "2026-05-09T00:00:00Z",
        updated_at: "2026-05-09T00:05:00Z",
      }),
    ).toThrow();
  });

  it("invalidates mute settings and article-derived views without changing scope semantics", () => {
    expect(resolveMuteKeywordInvalidationQueryKeys()).toEqual([
      ["muteKeywords"],
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.feeds.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ]);
  });

  it("uses the same mute keyword root query key for the query hook and invalidation", () => {
    useQueryMock.mockClear();

    useMuteKeywords();

    const invalidationRootQueryKey = resolveMuteKeywordInvalidationQueryKeys()[0];
    const queryOptions = useQueryMock.mock.calls[0]?.[0];

    expect(invalidationRootQueryKey).toBe(MUTE_KEYWORD_QUERY_KEY);
    expect(queryOptions?.queryKey).toBe(invalidationRootQueryKey);
  });
});
