import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it } from "vitest";
import { parsePrefix, useCommandSearch } from "@/components/reader/hooks/command-palette/use-command-search";

setupBrowserTestDom();

afterEach(() => {
  cleanup();
});

describe("useCommandSearch", () => {
  it("returns the immediate prefix and query and exposes deferredQuery", () => {
    const { result, rerender } = renderHook(({ input }) => useCommandSearch(input), {
      initialProps: { input: "   >   refresh" },
    });

    expect(result.current.prefix).toBe(">");
    expect(result.current.query).toBe("refresh");
    expect(result.current.deferredQuery).toBe("refresh");

    rerender({ input: "@ inbox" });

    expect(result.current.prefix).toBe("@");
    expect(result.current.query).toBe("inbox");
    expect(typeof result.current.deferredQuery).toBe("string");
  });
});

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
