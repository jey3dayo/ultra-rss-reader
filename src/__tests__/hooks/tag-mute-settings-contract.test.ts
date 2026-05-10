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

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn((options: { queryKey?: unknown }) => options),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: useQueryMock,
}));

describe("tag settings and reader tag contracts", () => {
  it("keeps create, rename, delete, and count command schemas scoped to tag payloads", () => {
    expect(createTagArgs.parse({ name: "Review", color: "#6f8eb8" })).toEqual({
      name: "Review",
      color: "#6f8eb8",
    });
    expect(createTagArgs.parse({ name: "Review" })).toEqual({ name: "Review" });
    expect(
      renameTagArgs.parse({ tagId: "tag-1", name: "Later", color: null }),
    ).toEqual({
      tagId: "tag-1",
      name: "Later",
      color: null,
    });
    expect(deleteTagArgs.parse({ tagId: "tag-1" })).toEqual({ tagId: "tag-1" });
    expect(getTagArticleCountsArgs.parse({ accountId: "acc-1" })).toEqual({
      accountId: "acc-1",
    });
    expect(
      listArticlesByTagArgs.parse({
        tagId: "tag-1",
        accountId: "acc-1",
        mode: "unread",
      }),
    ).toEqual({
      tagId: "tag-1",
      accountId: "acc-1",
      mode: "unread",
    });

    expect(() =>
      createTagArgs.parse({ name: "Review", color: null }),
    ).toThrow();
    expect(() => renameTagArgs.parse({ name: "Later" })).toThrow();
    expect(() => deleteTagArgs.parse({})).toThrow();
  });

  it("keeps tag response schemas compatible with settings, reader tag list, and picker views", () => {
    expect(
      TagDtoSchema.parse({ id: "tag-1", name: "Review", color: null }),
    ).toEqual({
      id: "tag-1",
      name: "Review",
      color: null,
    });
    expect(TagArticleCountsSchema.parse({ "tag-1": 0, "tag-2": 3 })).toEqual({
      "tag-1": 0,
      "tag-2": 3,
    });

    expect(() => TagArticleCountsSchema.parse({ "tag-1": -1 })).toThrow();
  });

  it("keeps tag response names non-blank while preserving the nullable color contract", () => {
    expect(
      TagDtoSchema.parse({ id: "tag-1", name: "  Review  ", color: null }),
    ).toEqual({
      id: "tag-1",
      name: "Review",
      color: null,
    });
    expect(() =>
      TagDtoSchema.parse({ id: "tag-1", name: "   ", color: null }),
    ).toThrow();
  });

  it("separates tag metadata and article assignment cache updates", () => {
    expect(resolveTagMutationInvalidationQueryKeys("create")).toEqual([
      ["tags"],
    ]);
    expect(
      resolveTagMutationInvalidationQueryKeys("articleAssignment"),
    ).toEqual([["articleTags"], ["articlesByTag"], ["tagArticleCounts"]]);
    expect(resolveTagMutationInvalidationQueryKeys("metadata")).toEqual([
      ["tags"],
      ["articleTags"],
      ["articlesByTag"],
      ["tagArticleCounts"],
    ]);
  });
});

describe("mute settings contracts", () => {
  it("keeps create, update, delete, and auto-mark command schemas scoped to mute keyword payloads", () => {
    expect(
      createMuteKeywordArgs.parse({ keyword: "spoiler", scope: "title" }),
    ).toEqual({
      keyword: "spoiler",
      scope: "title",
    });
    expect(
      createMuteKeywordArgs.parse({ keyword: " spoiler ", scope: "title" }),
    ).toEqual({
      keyword: "spoiler",
      scope: "title",
    });
    expect(
      updateMuteKeywordArgs.parse({
        muteKeywordId: "mute-1",
        scope: "title_and_body",
      }),
    ).toEqual({
      muteKeywordId: "mute-1",
      scope: "title_and_body",
    });
    expect(deleteMuteKeywordArgs.parse({ muteKeywordId: "mute-1" })).toEqual({
      muteKeywordId: "mute-1",
    });
    expect(setMuteAutoMarkReadArgs.parse({ enabled: true })).toEqual({
      enabled: true,
    });

    expect(() =>
      createMuteKeywordArgs.parse({ keyword: "spoiler", scope: "all" }),
    ).toThrow();
    expect(() =>
      createMuteKeywordArgs.parse({ keyword: "", scope: "title" }),
    ).toThrow();
    expect(() =>
      createMuteKeywordArgs.parse({ keyword: "   ", scope: "title" }),
    ).toThrow();
    expect(() =>
      updateMuteKeywordArgs.parse({ muteKeywordId: "mute-1", scope: "all" }),
    ).toThrow();
    expect(() => deleteMuteKeywordArgs.parse({})).toThrow();
  });

  it("keeps mute keyword text validation aligned with app input trimming", () => {
    expect(MuteKeywordKeywordSchema.parse("  spoiler  ")).toBe("spoiler");
    expect(MuteKeywordKeywordSchema.parse(" セール告知 ")).toBe("セール告知");

    expect(() => MuteKeywordKeywordSchema.parse("AI")).toThrow();
    expect(() => MuteKeywordKeywordSchema.parse(" あ ")).toThrow();
    expect(() => MuteKeywordKeywordSchema.parse("   ")).toThrow();
  });

  it("keeps mute keyword response schemas independent from tag visual contracts", () => {
    expect(MuteKeywordScopeSchema.parse("body")).toBe("body");
    expect(MuteKeywordScopeSchema.options).toEqual([
      "title",
      "body",
      "title_and_body",
    ]);
    expect(
      MuteKeywordDtoSchema.parse({
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
      MuteKeywordDtoSchema.parse({
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
      MuteKeywordDtoSchema.parse({
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
      ["articles"],
      ["accountArticles"],
      ["folderArticles"],
      ["starredArticles"],
      ["accountUnreadCount"],
      ["accountStarredCount"],
      ["feeds"],
      ["articlesByTag"],
      ["tagArticleCounts"],
      ["search"],
      ["recentArticles"],
      ["feedArticleSummaries"],
    ]);
  });

  it("uses the same mute keyword root query key for the query hook and invalidation", () => {
    useQueryMock.mockClear();

    useMuteKeywords();

    const invalidationRootQueryKey =
      resolveMuteKeywordInvalidationQueryKeys()[0];
    const queryOptions = useQueryMock.mock.calls[0]?.[0];

    expect(invalidationRootQueryKey).toBe(MUTE_KEYWORD_QUERY_KEY);
    expect(queryOptions?.queryKey).toBe(invalidationRootQueryKey);
  });
});
