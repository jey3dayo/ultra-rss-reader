import { describe, expect, it } from "vitest";
import { resolveReaderQuery, resolveReaderSourcePlan } from "@/lib/reader/reader-query";

describe("resolveReaderQuery", () => {
  it("normalizes smart views to account-scoped reader queries", () => {
    expect(resolveReaderQuery({ type: "smart", kind: "unread" }, "all", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "account", accountId: "acc-1" },
      filter: "unread",
    });
    expect(resolveReaderQuery({ type: "smart", kind: "starred" }, "unread", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "account", accountId: "acc-1" },
      filter: "starred",
    });
    expect(resolveReaderQuery({ type: "smart", kind: "recent" }, "all", "acc-1")).toEqual({
      source: "recent",
      scope: { type: "account", accountId: "acc-1" },
      filter: "all",
    });
  });

  it("normalizes all selection with starred mode to account starred", () => {
    expect(resolveReaderQuery({ type: "all" }, "starred", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "account", accountId: "acc-1" },
      filter: "starred",
    });
  });

  it("normalizes recent smart view with footer filters to recent account queries", () => {
    expect(resolveReaderQuery({ type: "smart", kind: "recent" }, "unread", "acc-1")).toEqual({
      source: "recent",
      scope: { type: "account", accountId: "acc-1" },
      filter: "unread",
    });
    expect(resolveReaderQuery({ type: "smart", kind: "recent" }, "starred", "acc-1")).toEqual({
      source: "recent",
      scope: { type: "account", accountId: "acc-1" },
      filter: "starred",
    });
  });

  it("normalizes regular folder, feed, and tag selections to unread mode", () => {
    expect(resolveReaderQuery({ type: "folder", folderId: "folder-1" }, "unread", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "folder", folderId: "folder-1" },
      filter: "unread",
    });
    expect(resolveReaderQuery({ type: "feed", feedId: "feed-1" }, "unread", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "feed", feedId: "feed-1" },
      filter: "unread",
    });
    expect(resolveReaderQuery({ type: "tag", tagId: "tag-1" }, "unread", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "tag", tagId: "tag-1" },
      filter: "unread",
    });
  });

  it("normalizes folder, feed, and tag selections in starred context to starred mode", () => {
    expect(resolveReaderQuery({ type: "folder", folderId: "folder-1" }, "starred", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "folder", folderId: "folder-1" },
      filter: "starred",
    });
    expect(resolveReaderQuery({ type: "feed", feedId: "feed-1" }, "starred", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "feed", feedId: "feed-1" },
      filter: "starred",
    });
    expect(resolveReaderQuery({ type: "tag", tagId: "tag-1" }, "starred", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "tag", tagId: "tag-1" },
      filter: "starred",
    });
  });

  it("returns null when there is no selected account", () => {
    expect(resolveReaderQuery({ type: "all" }, "unread", null)).toBeNull();
    expect(resolveReaderQuery({ type: "feed", feedId: "feed-1" }, "unread", null)).toBeNull();
  });
});

describe("resolveReaderSourcePlan", () => {
  it("builds a non-colliding source plan for each reader scope", () => {
    const cases = [
      {
        selection: { type: "all" } as const,
        viewMode: "starred" as const,
        expected: {
          sourceKind: "account",
          sourceKey: "account:acc-1:articles:starred",
          accountId: "acc-1",
          feedId: null,
          folderId: null,
          tagId: null,
          accountMode: "starred",
          feedMode: "all",
          folderMode: "all",
          tagMode: "all",
          recentMode: "all",
          effectiveViewMode: "starred",
          preservesRecentOrder: false,
        },
      },
      {
        selection: { type: "folder", folderId: "folder-1" } as const,
        viewMode: "unread" as const,
        expected: {
          sourceKind: "folder",
          sourceKey: "folder:folder-1:unread",
          accountId: null,
          feedId: null,
          folderId: "folder-1",
          tagId: null,
          accountMode: "all",
          feedMode: "all",
          folderMode: "unread",
          tagMode: "all",
          recentMode: "all",
          effectiveViewMode: "unread",
          preservesRecentOrder: false,
        },
      },
      {
        selection: { type: "feed", feedId: "feed-1" } as const,
        viewMode: "starred" as const,
        expected: {
          sourceKind: "feed",
          sourceKey: "feed:feed-1:starred",
          accountId: null,
          feedId: "feed-1",
          folderId: null,
          tagId: null,
          accountMode: "all",
          feedMode: "starred",
          folderMode: "all",
          tagMode: "all",
          recentMode: "all",
          effectiveViewMode: "starred",
          preservesRecentOrder: false,
        },
      },
      {
        selection: { type: "tag", tagId: "tag-1" } as const,
        viewMode: "all" as const,
        expected: {
          sourceKind: "tag",
          sourceKey: "tag:tag-1:all",
          accountId: null,
          feedId: null,
          folderId: null,
          tagId: "tag-1",
          accountMode: "all",
          feedMode: "all",
          folderMode: "all",
          tagMode: "all",
          recentMode: "all",
          effectiveViewMode: "all",
          preservesRecentOrder: false,
        },
      },
      {
        selection: { type: "smart", kind: "recent" } as const,
        viewMode: "starred" as const,
        expected: {
          sourceKind: "recent",
          sourceKey: "recent:acc-1:starred",
          accountId: "acc-1",
          feedId: null,
          folderId: null,
          tagId: null,
          accountMode: "all",
          feedMode: "all",
          folderMode: "all",
          tagMode: "all",
          recentMode: "starred",
          effectiveViewMode: "starred",
          preservesRecentOrder: true,
        },
      },
    ];

    for (const testCase of cases) {
      expect(resolveReaderSourcePlan(testCase.selection, testCase.viewMode, "acc-1")).toMatchObject(testCase.expected);
    }
    expect(new Set(cases.map((testCase) => testCase.expected.sourceKey)).size).toBe(cases.length);
  });

  it("returns disabled ids and null query when account selection cannot be resolved", () => {
    expect(resolveReaderSourcePlan({ type: "all" }, "unread", null)).toMatchObject({
      query: null,
      sourceKind: "none",
      sourceKey: "none",
      accountId: null,
      feedId: null,
      folderId: null,
      tagId: null,
      effectiveViewMode: "unread",
      preservesRecentOrder: false,
    });
  });

  it("keeps smart starred source filtering separate from the footer display filter", () => {
    expect(resolveReaderSourcePlan({ type: "smart", kind: "starred" }, "all", "acc-1")).toMatchObject({
      sourceKind: "account",
      sourceKey: "account:acc-1:articles:starred",
      accountMode: "starred",
      effectiveViewMode: "all",
    });
    expect(resolveReaderSourcePlan({ type: "smart", kind: "starred" }, "unread", "acc-1")).toMatchObject({
      sourceKind: "account",
      sourceKey: "account:acc-1:articles:starred",
      accountMode: "starred",
      effectiveViewMode: "unread",
    });
  });
});
