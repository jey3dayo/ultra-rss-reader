import { describe, expect, it } from "vitest";
import { parsePrefix } from "@/components/reader/hooks/command-palette/use-command-search";

describe("parsePrefix", () => {
  it.each([
    ["leading whitespace", "   >refresh", { prefix: ">", query: "refresh" }],
    ["prefix trailing whitespace", ">   refresh", { prefix: ">", query: "refresh" }],
    ["prefix only", "   #   ", { prefix: "#", query: "" }],
    ["normal search query", "   search feeds", { prefix: null, query: "search feeds" }],
    ["repeated action prefix", ">>sync", { prefix: ">", query: ">sync" }],
    ["repeated feed prefix", "@@feed", { prefix: "@", query: "@feed" }],
    ["repeated tag prefix", "##tag", { prefix: "#", query: "#tag" }],
    ["whitespace between repeated prefixes", ">   >sync", { prefix: ">", query: ">sync" }],
    ["full-width action prefix", "＞同期", { prefix: ">", query: "同期" }],
    ["full-width feed prefix", "＠ フィード", { prefix: "@", query: "フィード" }],
    ["full-width tag prefix", "＃タグ", { prefix: "#", query: "タグ" }],
    ["leading zero-width space before prefix", "\u200B>sync", { prefix: ">", query: "sync" }],
    ["leading newline and tab before prefix", "\n\t@inbox", { prefix: "@", query: "inbox" }],
    ["unknown prefix-like character", "$feed", { prefix: null, query: "$feed" }],
    ["prefix-looking IME text stays normal search", "＞＞同期", { prefix: ">", query: "＞同期" }],
  ] as const)("parses %s", (_label, input, expected) => {
    expect(parsePrefix(input)).toEqual(expected);
  });

  it("returns null prefix for plain text", () => {
    expect(parsePrefix("search feeds")).toEqual({
      prefix: null,
      query: "search feeds",
    });
  });

  it("parses action queries with >", () => {
    expect(parsePrefix("> sync now")).toEqual({
      prefix: ">",
      query: "sync now",
    });
  });

  it("parses feed queries with @", () => {
    expect(parsePrefix("@ inbox")).toEqual({ prefix: "@", query: "inbox" });
  });

  it("parses tag queries with #", () => {
    expect(parsePrefix("# important")).toEqual({
      prefix: "#",
      query: "important",
    });
  });

  it("trims whitespace after the prefix", () => {
    expect(parsePrefix("   >    refresh")).toEqual({
      prefix: ">",
      query: "refresh",
    });
  });

  it("supports a prefix with no query", () => {
    expect(parsePrefix("@")).toEqual({ prefix: "@", query: "" });
  });
});
