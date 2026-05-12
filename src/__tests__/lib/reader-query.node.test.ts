import { describe, expect, it } from "vitest";
import {
  type ReaderFilter,
  type ReaderQuery,
  type ReaderQuerySelection,
  resolveReaderQuery,
  resolveReaderSearchResultPolicy,
  resolveReaderSourcePlan,
  shouldRecoverUnavailableReaderSelection,
} from "@/lib/reader/reader-query";

function expectedReaderQuery(query: ReaderQuery): ReaderQuery {
  return query;
}

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

  it("returns a disabled query when there is no selected account", () => {
    expect(resolveReaderQuery({ type: "all" }, "unread", null)).toEqual({
      source: "disabled",
      reason: "missing_account",
    });
    expect(resolveReaderQuery({ type: "feed", feedId: "feed-1" }, "unread", null)).toEqual({
      source: "disabled",
      reason: "missing_account",
    });
  });

  it("treats blank selected account ids as unresolved", () => {
    expect(resolveReaderQuery({ type: "all" }, "unread", "   ")).toEqual({
      source: "disabled",
      reason: "missing_account",
    });
    expect(resolveReaderQuery({ type: "smart", kind: "recent" }, "all", "\n")).toEqual({
      source: "disabled",
      reason: "missing_account",
    });
    expect(resolveReaderQuery({ type: "all" }, "unread", " acc-1 ")).toEqual({
      source: "articles",
      scope: { type: "account", accountId: "acc-1" },
      filter: "unread",
    });
  });

  it("treats blank feed, folder, and tag scope ids as invalid selections", () => {
    expect(resolveReaderQuery({ type: "feed", feedId: " " }, "unread", "acc-1")).toEqual({
      source: "disabled",
      reason: "invalid_selection",
    });
    expect(resolveReaderQuery({ type: "folder", folderId: "\n" }, "unread", "acc-1")).toEqual({
      source: "disabled",
      reason: "invalid_selection",
    });
    expect(resolveReaderQuery({ type: "tag", tagId: "" }, "unread", "acc-1")).toEqual({
      source: "disabled",
      reason: "invalid_selection",
    });
    expect(resolveReaderQuery({ type: "feed", feedId: " feed-1 " }, "unread", "acc-1")).toEqual({
      source: "articles",
      scope: { type: "feed", feedId: "feed-1" },
      filter: "unread",
    });
  });
});

describe("resolveReaderSourcePlan", () => {
  it("matches the reader article scope matrix for every source and filter", () => {
    const cases: Array<{
      selection: ReaderQuerySelection;
      viewMode: ReaderFilter;
      expected: {
        query: ReaderQuery;
        sourceKind: string;
        sourceKey: string;
        accountId: string | null;
        folderId: string | null;
        feedId: string | null;
        tagId: string | null;
        accountMode: ReaderFilter;
        folderMode: ReaderFilter;
        feedMode: ReaderFilter;
        tagMode: ReaderFilter;
        recentMode: ReaderFilter;
        preservesRecentOrder: boolean;
      };
    }> = [
      {
        selection: { type: "smart", kind: "unread" },
        viewMode: "all",
        expected: {
          query: expectedReaderQuery({
            source: "articles",
            scope: { type: "account", accountId: "acc-1" },
            filter: "unread",
          }),
          sourceKind: "account",
          sourceKey: "account:acc-1:articles:unread",
          accountId: "acc-1",
          folderId: null,
          feedId: null,
          tagId: null,
          accountMode: "unread",
          folderMode: "all",
          feedMode: "all",
          tagMode: "all",
          recentMode: "all",
          preservesRecentOrder: false,
        },
      },
      {
        selection: { type: "all" },
        viewMode: "all",
        expected: {
          query: expectedReaderQuery({
            source: "articles",
            scope: { type: "account", accountId: "acc-1" },
            filter: "all",
          }),
          sourceKind: "account",
          sourceKey: "account:acc-1:articles:all",
          accountId: "acc-1",
          folderId: null,
          feedId: null,
          tagId: null,
          accountMode: "all",
          folderMode: "all",
          feedMode: "all",
          tagMode: "all",
          recentMode: "all",
          preservesRecentOrder: false,
        },
      },
      {
        selection: { type: "smart", kind: "starred" },
        viewMode: "all",
        expected: {
          query: expectedReaderQuery({
            source: "articles",
            scope: { type: "account", accountId: "acc-1" },
            filter: "starred",
          }),
          sourceKind: "account",
          sourceKey: "account:acc-1:articles:starred",
          accountId: "acc-1",
          folderId: null,
          feedId: null,
          tagId: null,
          accountMode: "starred",
          folderMode: "all",
          feedMode: "all",
          tagMode: "all",
          recentMode: "all",
          preservesRecentOrder: false,
        },
      },
      ...(["unread", "all", "starred"] as const).map((viewMode) => ({
        selection: { type: "folder", folderId: "folder-1" } as const,
        viewMode,
        expected: {
          query: expectedReaderQuery({
            source: "articles",
            scope: { type: "folder", folderId: "folder-1" },
            filter: viewMode,
          }),
          sourceKind: "folder",
          sourceKey: `folder:folder-1:${viewMode}`,
          accountId: null,
          folderId: "folder-1",
          feedId: null,
          tagId: null,
          accountMode: "all" as const,
          folderMode: viewMode,
          feedMode: "all" as const,
          tagMode: "all" as const,
          recentMode: "all" as const,
          preservesRecentOrder: false,
        },
      })),
      ...(["unread", "all", "starred"] as const).map((viewMode) => ({
        selection: { type: "feed", feedId: "feed-1" } as const,
        viewMode,
        expected: {
          query: expectedReaderQuery({
            source: "articles",
            scope: { type: "feed", feedId: "feed-1" },
            filter: viewMode,
          }),
          sourceKind: "feed",
          sourceKey: `feed:feed-1:${viewMode}`,
          accountId: null,
          folderId: null,
          feedId: "feed-1",
          tagId: null,
          accountMode: "all" as const,
          folderMode: "all" as const,
          feedMode: viewMode,
          tagMode: "all" as const,
          recentMode: "all" as const,
          preservesRecentOrder: false,
        },
      })),
      ...(["unread", "all", "starred"] as const).map((viewMode) => ({
        selection: { type: "tag", tagId: "tag-1" } as const,
        viewMode,
        expected: {
          query: expectedReaderQuery({
            source: "articles",
            scope: { type: "tag", tagId: "tag-1" },
            filter: viewMode,
          }),
          sourceKind: "tag",
          sourceKey: `tag:tag-1:${viewMode}`,
          accountId: null,
          folderId: null,
          feedId: null,
          tagId: "tag-1",
          accountMode: "all" as const,
          folderMode: "all" as const,
          feedMode: "all" as const,
          tagMode: viewMode,
          recentMode: "all" as const,
          preservesRecentOrder: false,
        },
      })),
      ...(["unread", "all", "starred"] as const).map((viewMode) => ({
        selection: { type: "smart", kind: "recent" } as const,
        viewMode,
        expected: {
          query: expectedReaderQuery({
            source: "recent",
            scope: { type: "account", accountId: "acc-1" },
            filter: viewMode,
          }),
          sourceKind: "recent",
          sourceKey: `recent:acc-1:${viewMode}`,
          accountId: "acc-1",
          folderId: null,
          feedId: null,
          tagId: null,
          accountMode: "all" as const,
          folderMode: "all" as const,
          feedMode: "all" as const,
          tagMode: "all" as const,
          recentMode: viewMode,
          preservesRecentOrder: true,
        },
      })),
    ];

    for (const { selection, viewMode, expected } of cases) {
      expect(resolveReaderSourcePlan(selection, viewMode, "acc-1")).toMatchObject(expected);
    }
  });

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
    expect(resolveReaderSourcePlan({ type: "all" }, "unread", "   ")).toMatchObject({
      query: null,
      sourceKind: "none",
      sourceKey: "none",
    });
    expect(resolveReaderSourcePlan({ type: "feed", feedId: "   " }, "unread", "acc-1")).toMatchObject({
      query: null,
      sourceKind: "none",
      sourceKey: "none",
    });
    expect(resolveReaderSourcePlan({ type: "folder", folderId: "\n\t" }, "starred", "acc-1")).toMatchObject({
      query: null,
      sourceKind: "none",
      sourceKey: "none",
      effectiveViewMode: "starred",
    });
    expect(resolveReaderSourcePlan({ type: "tag", tagId: "" }, "all", "acc-1")).toMatchObject({
      query: null,
      sourceKind: "none",
      sourceKey: "none",
      effectiveViewMode: "all",
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

  it("keeps smart unread source filtering ahead of footer display filters", () => {
    expect(resolveReaderSourcePlan({ type: "smart", kind: "unread" }, "all", "acc-1")).toMatchObject({
      sourceKind: "account",
      sourceKey: "account:acc-1:articles:unread",
      accountMode: "unread",
      effectiveViewMode: "unread",
    });
    expect(resolveReaderSourcePlan({ type: "smart", kind: "unread" }, "starred", "acc-1")).toMatchObject({
      sourceKind: "account",
      sourceKey: "account:acc-1:articles:unread",
      accountMode: "unread",
      effectiveViewMode: "unread",
    });
  });
});

describe("resolveReaderSearchResultPolicy", () => {
  it("keeps search owner and result ordering policy explicit for account, folder, and unread searches", () => {
    const retainedArticleIds = new Set(["art-selected"]);
    const cases = [
      {
        sourcePlan: resolveReaderSourcePlan({ type: "all" }, "all", "acc-1"),
        sortUnread: "newest_first",
        expected: {
          ownerSourceKey: "account:acc-1:articles:all",
          preservesSearchRanking: true,
          appliesUnreadSort: true,
          includesRetainedSelectedArticle: true,
          missingResultArticlePolicy: "exclude",
        },
      },
      {
        sourcePlan: resolveReaderSourcePlan({ type: "folder", folderId: "folder-1" }, "unread", "acc-1"),
        sortUnread: "oldest_first",
        expected: {
          ownerSourceKey: "folder:folder-1:unread",
          preservesSearchRanking: true,
          appliesUnreadSort: true,
          includesRetainedSelectedArticle: true,
          missingResultArticlePolicy: "exclude",
        },
      },
    ];

    for (const testCase of cases) {
      expect(
        resolveReaderSearchResultPolicy({
          sourcePlan: testCase.sourcePlan,
          sortUnread: testCase.sortUnread,
          retainedArticleIds,
          selectedArticleId: "art-selected",
        }),
      ).toEqual(testCase.expected);
    }
  });

  it("does not treat missing search results as retained selected articles", () => {
    expect(
      resolveReaderSearchResultPolicy({
        sourcePlan: resolveReaderSourcePlan({ type: "all" }, "all", "acc-1"),
        sortUnread: "custom",
        retainedArticleIds: new Set(["art-other"]),
        selectedArticleId: "art-selected",
      }),
    ).toEqual({
      ownerSourceKey: "account:acc-1:articles:all",
      preservesSearchRanking: true,
      appliesUnreadSort: false,
      includesRetainedSelectedArticle: false,
      missingResultArticlePolicy: "exclude",
    });
  });
});

describe("shouldRecoverUnavailableReaderSelection", () => {
  it("recovers selected feed, folder, and tag ids only after the matching inventory is loaded and missing", () => {
    expect(
      shouldRecoverUnavailableReaderSelection(
        { type: "feed", feedId: "feed-missing" },
        { feedIds: new Set(["feed-1"]) },
      ),
    ).toBe(true);
    expect(
      shouldRecoverUnavailableReaderSelection(
        { type: "folder", folderId: "folder-missing" },
        { folderIds: new Set(["folder-1"]) },
      ),
    ).toBe(true);
    expect(
      shouldRecoverUnavailableReaderSelection({ type: "tag", tagId: "tag-missing" }, { tagIds: new Set(["tag-1"]) }),
    ).toBe(true);

    expect(shouldRecoverUnavailableReaderSelection({ type: "feed", feedId: "feed-1" }, {})).toBe(false);
    expect(
      shouldRecoverUnavailableReaderSelection(
        { type: "folder", folderId: "folder-1" },
        { folderIds: new Set(["folder-1"]) },
      ),
    ).toBe(false);
    expect(shouldRecoverUnavailableReaderSelection({ type: "all" }, { feedIds: new Set() })).toBe(false);
    expect(
      shouldRecoverUnavailableReaderSelection(
        { type: "smart", kind: "unread" },
        { feedIds: new Set(), folderIds: new Set(), tagIds: new Set() },
      ),
    ).toBe(false);
  });
});
