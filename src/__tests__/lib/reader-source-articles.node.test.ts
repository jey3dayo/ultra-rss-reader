import { describe, expect, it } from "vitest";
import type { ReaderQuerySelection } from "@/lib/reader/reader-query";
import { resolveReaderSelectionSourceKind, resolveReaderSourceArticles } from "@/lib/reader/reader-source-articles";

type Article = { id: string };

const feedArticles: Article[] = [{ id: "feed-1" }];
const folderArticles: Article[] = [{ id: "folder-1" }];
const tagArticles: Article[] = [{ id: "tag-1" }];
const recentArticles: Article[] = [{ id: "recent-1" }, { id: "recent-2" }];
const fallbackArticles: Article[] = [{ id: "fallback-1" }];

describe("resolveReaderSelectionSourceKind", () => {
  it("maps the recent smart view to the recent source kind", () => {
    const selection: ReaderQuerySelection = { type: "smart", kind: "recent" };
    expect(resolveReaderSelectionSourceKind(selection)).toBe("recent");
  });

  it("keeps other smart views unmapped so they fall back to filtered articles", () => {
    expect(resolveReaderSelectionSourceKind({ type: "smart", kind: "unread" })).toBeNull();
    expect(resolveReaderSelectionSourceKind({ type: "smart", kind: "starred" })).toBeNull();
    expect(resolveReaderSelectionSourceKind({ type: "all" })).toBeNull();
  });

  it("still maps concrete selectable sources", () => {
    expect(resolveReaderSelectionSourceKind({ type: "feed", feedId: "f1" })).toBe("feed");
    expect(resolveReaderSelectionSourceKind({ type: "folder", folderId: "fo1" })).toBe("folder");
    expect(resolveReaderSelectionSourceKind({ type: "tag", tagId: "t1" })).toBe("tag");
  });
});

describe("resolveReaderSourceArticles", () => {
  it("returns all-recent articles for the recent source instead of falling back", () => {
    const resolved = resolveReaderSourceArticles({
      sourceKind: "recent",
      feedArticles,
      folderArticles,
      tagArticles,
      recentArticles,
      fallbackArticles,
    });
    expect(resolved).toBe(recentArticles);
    expect(resolved).toHaveLength(2);
  });

  it("falls back when recent articles are not yet loaded", () => {
    const resolved = resolveReaderSourceArticles({
      sourceKind: "recent",
      feedArticles,
      folderArticles,
      tagArticles,
      recentArticles: undefined,
      fallbackArticles,
    });
    expect(resolved).toBe(fallbackArticles);
  });

  it("does not divert non-recent sources to recent articles", () => {
    expect(
      resolveReaderSourceArticles({
        sourceKind: "feed",
        feedArticles,
        folderArticles,
        tagArticles,
        recentArticles,
      }),
    ).toBe(feedArticles);
  });
});
