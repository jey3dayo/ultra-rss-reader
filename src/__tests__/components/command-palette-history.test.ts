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
  });

  it("formats history values from structured entries", () => {
    expect(createCommandPaletteHistoryValue({ kind: "action", id: "open-settings" })).toBe("action:open-settings");
    expect(createCommandPaletteHistoryValue({ kind: "feed", id: "feed-1" })).toBe("feed:feed-1");
  });
});
