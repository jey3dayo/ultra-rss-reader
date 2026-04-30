import { describe, expect, it } from "vitest";
import { getPrimarySourceContext } from "@/components/reader/article-selection-context";

describe("article-selection-context", () => {
  it("builds feed and tag context keys with the selected account", () => {
    expect(getPrimarySourceContext({ type: "feed", feedId: "feed-1" }, "acc-1")).toEqual({
      kind: "feed",
      key: "feed:acc-1:feed-1",
    });
    expect(getPrimarySourceContext({ type: "tag", tagId: "tag-1" }, "acc-1")).toEqual({
      kind: "tag",
      key: "tag:acc-1:tag-1",
    });
  });

  it("builds account-scoped context keys for folder, smart, and all selections", () => {
    expect(getPrimarySourceContext({ type: "folder", folderId: "folder-1" }, "acc-1")).toEqual({
      kind: "account",
      key: "account:acc-1:folder:folder-1",
    });
    expect(getPrimarySourceContext({ type: "smart", kind: "recent" }, "acc-1")).toEqual({
      kind: "account",
      key: "account:acc-1:smart:recent",
    });
    expect(getPrimarySourceContext({ type: "all" }, "acc-1")).toEqual({
      kind: "account",
      key: "account:acc-1:all",
    });
  });

  it("uses a stable null account segment when no account is selected", () => {
    expect(getPrimarySourceContext({ type: "all" }, null)).toEqual({
      kind: "account",
      key: "account:null:all",
    });
  });
});
