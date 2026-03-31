import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_COMMAND_HISTORY, STORAGE_KEYS } from "@/constants/storage";
import { addToHistory, clearHistory, getHistory } from "../../hooks/use-command-history";

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
});
