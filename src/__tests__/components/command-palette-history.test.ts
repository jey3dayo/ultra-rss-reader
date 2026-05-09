import { describe, expect, it } from "vitest";
import {
  createCommandPaletteHistoryValue,
  parseCommandPaletteHistoryEntry,
} from "@/components/reader/command-palette-history";

describe("command-palette-history", () => {
  it("parses each supported history prefix", () => {
    expect(parseCommandPaletteHistoryEntry("action:open-settings")).toEqual({
      kind: "action",
      id: "open-settings",
    });
    expect(parseCommandPaletteHistoryEntry("feed:feed-1")).toEqual({
      kind: "feed",
      id: "feed-1",
    });
    expect(parseCommandPaletteHistoryEntry("tag:tag-1")).toEqual({
      kind: "tag",
      id: "tag-1",
    });
    expect(parseCommandPaletteHistoryEntry("article:art-1")).toEqual({
      kind: "article",
      id: "art-1",
    });
  });

  it("returns null for unsupported values", () => {
    expect(parseCommandPaletteHistoryEntry("unknown:value")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("action")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("feed:")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("tag:")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("article:")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("action:removed-action")).toBeNull();
  });

  it("rejects blank resource ids and trims padded resource ids", () => {
    expect(parseCommandPaletteHistoryEntry("feed:   ")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("tag:\n")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("article:\t ")).toBeNull();
    expect(parseCommandPaletteHistoryEntry("feed: feed-1 ")).toEqual({
      kind: "feed",
      id: "feed-1",
    });
    expect(parseCommandPaletteHistoryEntry("tag:\ntag-1\t")).toEqual({
      kind: "tag",
      id: "tag-1",
    });
  });

  it("formats history values from structured entries", () => {
    expect(createCommandPaletteHistoryValue({ kind: "action", id: "open-settings" })).toBe("action:open-settings");
    expect(createCommandPaletteHistoryValue({ kind: "feed", id: "feed-1" })).toBe("feed:feed-1");
    expect(createCommandPaletteHistoryValue({ kind: "tag", id: "tag-1" })).toBe("tag:tag-1");
    expect(createCommandPaletteHistoryValue({ kind: "article", id: "art-1" })).toBe("article:art-1");
  });

  it("roundtrips non-action resource history values", () => {
    const entries = [
      { kind: "feed", id: "feed-1" },
      { kind: "tag", id: "tag-1" },
      { kind: "article", id: "art-1" },
    ] as const;

    for (const entry of entries) {
      expect(parseCommandPaletteHistoryEntry(createCommandPaletteHistoryValue(entry))).toEqual(entry);
    }
  });
});
