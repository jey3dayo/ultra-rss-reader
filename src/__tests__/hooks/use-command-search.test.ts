import { describe, expect, it } from "vitest";
import { parsePrefix } from "../../hooks/use-command-search";

describe("parsePrefix", () => {
  it("returns null prefix for plain text", () => {
    expect(parsePrefix("search feeds")).toEqual({ prefix: null, query: "search feeds" });
  });

  it("parses action queries with >", () => {
    expect(parsePrefix("> sync now")).toEqual({ prefix: ">", query: "sync now" });
  });

  it("parses feed queries with @", () => {
    expect(parsePrefix("@ inbox")).toEqual({ prefix: "@", query: "inbox" });
  });

  it("parses tag queries with #", () => {
    expect(parsePrefix("# important")).toEqual({ prefix: "#", query: "important" });
  });

  it("trims whitespace after the prefix", () => {
    expect(parsePrefix("   >    refresh")).toEqual({ prefix: ">", query: "refresh" });
  });

  it("supports a prefix with no query", () => {
    expect(parsePrefix("@")).toEqual({ prefix: "@", query: "" });
  });
});
