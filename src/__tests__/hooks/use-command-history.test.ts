import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToHistory,
  clearHistory,
  compactCommandHistory,
  getHistory,
} from "@/components/reader/hooks/command-palette/use-command-history";
import { MAX_COMMAND_HISTORY, STORAGE_KEYS } from "@/constants/storage";

describe("use-command-history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty array when history is missing", () => {
    expect(getHistory()).toEqual([]);
  });

  it("returns an empty array for invalid stored data", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, "not-json");

    expect(getHistory()).toEqual([]);
  });

  it("returns an empty array for non-array stored data", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify({ id: "feed-1" }));

    expect(getHistory()).toEqual([]);
  });

  it("discards non-string entries from stored history", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify(["feed:feed-1", null, { kind: "feed", id: "feed-2" }, 1, "action:open-settings"]),
    );

    expect(getHistory()).toEqual(["feed:feed-1", "action:open-settings"]);
  });

  it("adds items to the front of history", () => {
    addToHistory("feed-1");
    addToHistory("feed-2");

    expect(getHistory()).toEqual(["feed-2", "feed-1"]);
  });

  it("deduplicates existing items by moving them to the front", () => {
    addToHistory("feed-1");
    addToHistory("feed-2");
    addToHistory("feed-1");

    expect(getHistory()).toEqual(["feed-1", "feed-2"]);
  });

  it("compacts stored history after invalid entries are discarded", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify(["feed:feed-1", null, "feed:feed-2", { id: "feed-3" }, "tag:tag-1"]),
    );

    addToHistory("feed:feed-2");

    expect(getHistory()).toEqual(["feed:feed-2", "feed:feed-1", "tag:tag-1"]);
  });

  it("compacts raw history values by moving duplicates to the front and capping size", () => {
    const entries = Array.from({ length: MAX_COMMAND_HISTORY + 2 }, (_, index) => `item-${index}`);

    expect(compactCommandHistory(entries, "item-3")).toEqual([
      "item-3",
      "item-0",
      "item-1",
      "item-2",
      "item-4",
      "item-5",
      "item-6",
      "item-7",
      "item-8",
      "item-9",
    ]);
  });

  it("caps history to the maximum size", () => {
    for (let index = 0; index < MAX_COMMAND_HISTORY + 2; index += 1) {
      addToHistory(`item-${index}`);
    }

    expect(getHistory()).toHaveLength(MAX_COMMAND_HISTORY);
    expect(getHistory()).toEqual([
      "item-11",
      "item-10",
      "item-9",
      "item-8",
      "item-7",
      "item-6",
      "item-5",
      "item-4",
      "item-3",
      "item-2",
    ]);
  });

  it("clears the stored history entry", () => {
    addToHistory("feed-1");
    clearHistory();

    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
    expect(getHistory()).toEqual([]);
  });

  it("fails safely when storage write throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => addToHistory("feed-1")).not.toThrow();
    expect(getHistory()).toEqual([]);
  });

  it("fails safely when storage read throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => getHistory()).not.toThrow();
    expect(getHistory()).toEqual([]);
  });

  it("fails safely when storage clear throws", () => {
    addToHistory("feed-1");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => clearHistory()).not.toThrow();
    expect(getHistory()).toEqual(["feed-1"]);
  });
});
