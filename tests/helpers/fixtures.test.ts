import { describe, expect, it } from "vitest";
import { sampleAccounts, sampleArticles, sampleFeeds, sampleMuteKeywords, sampleTags } from "./fixtures";

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

    expect(sampleFeeds.every((feed) => accountIds.has(feed.account_id))).toBe(true);
    expect(sampleArticles.every((article) => feedIds.has(article.feed_id))).toBe(true);
  });

  it("keeps required fixture display fields populated", () => {
    expect(sampleAccounts.every((account) => account.name.trim().length > 0)).toBe(true);
    expect(sampleFeeds.every((feed) => feed.title.trim().length > 0 && feed.url.trim().length > 0)).toBe(true);
    expect(
      sampleArticles.every(
        (article) => article.title.trim().length > 0 && (article.url === null || article.url.trim().length > 0),
      ),
    ).toBe(true);
    expect(sampleTags.every((tag) => tag.name.trim().length > 0)).toBe(true);
  });
});
