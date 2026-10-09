import { describe, expect, it } from "vitest";
import { projectRecentPaletteEntries } from "@/components/reader/lib/recent-palette-entries";

const resources = {
  actions: [{ id: "sync-all" }, { id: "open-settings" }],
  feeds: [{ id: "f1" }],
  folders: [{ id: "d1" }],
  tags: [{ id: "t1" }],
  articles: [{ id: "a1" }],
};

describe("projectRecentPaletteEntries", () => {
  it("projects each kind into its own list in history order", () => {
    const result = projectRecentPaletteEntries({
      ...resources,
      resourcesReady: true,
      history: ["article:a1", "tag:t1", "folder:d1", "feed:f1", "action:open-settings", "action:sync-all"],
    });

    expect(result.recentActions.map((a) => a.id)).toEqual(["open-settings", "sync-all"]);
    expect(result.recentFeeds).toEqual([{ id: "f1" }]);
    expect(result.recentFolders).toEqual([{ id: "d1" }]);
    expect(result.recentTags).toEqual([{ id: "t1" }]);
    expect(result.recentArticles).toEqual([{ id: "a1" }]);
  });

  it("lists a duplicated history entry once", () => {
    const result = projectRecentPaletteEntries({
      ...resources,
      resourcesReady: false,
      history: ["action:sync-all", "action:sync-all"],
    });

    expect(result.recentActions).toEqual([{ id: "sync-all" }]);
  });

  it("keeps only actions and does not project history before resources are ready", () => {
    const history = ["feed:f1", "action:sync-all", "article:a1"];
    const result = projectRecentPaletteEntries({ ...resources, resourcesReady: false, history });

    expect(result.recentActions).toEqual([{ id: "sync-all" }]);
    expect(result.recentFeeds).toEqual([]);
    expect(result.recentArticles).toEqual([]);
    expect(result.historyProjection).toBeNull();
  });

  it("drops entries whose resource no longer exists and reports the normalized history", () => {
    const history = ["feed:gone", "feed:f1", "bogus", "tag:t1"];
    const result = projectRecentPaletteEntries({ ...resources, resourcesReady: true, history });

    expect(result.recentFeeds).toEqual([{ id: "f1" }]);
    expect(result.recentTags).toEqual([{ id: "t1" }]);
    expect(result.historyProjection).toEqual({ previous: history, next: ["feed:f1", "tag:t1"] });
  });
});
