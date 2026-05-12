import { installNodeTestStorage } from "@tests/helpers/node-test-storage";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToHistory,
  clearHistory,
  compactCommandHistory,
  getHistory,
  normalizeCommandHistoryForExistingEntries,
  projectCommandHistoryForExistingEntries,
  resetCommandHistoryStorageFailureWarnings,
  writeNormalizedHistoryAfterResourceProjection,
} from "@/components/reader/hooks/command-palette/use-command-history";
import { MAX_COMMAND_HISTORY, MAX_COMMAND_HISTORY_STORAGE_LENGTH, STORAGE_KEYS } from "@/constants/storage";
import { resetRuntimeDiagnosticOnceSuppressionForTests } from "@/lib/runtime/diagnostics";

const nodeTestStorage = installNodeTestStorage();

describe("use-command-history", () => {
  afterAll(() => {
    nodeTestStorage.restore();
  });

  beforeEach(() => {
    resetCommandHistoryStorageFailureWarnings();
    resetRuntimeDiagnosticOnceSuppressionForTests();
    localStorage.clear();
  });

  afterEach(() => {
    resetCommandHistoryStorageFailureWarnings();
    resetRuntimeDiagnosticOnceSuppressionForTests();
    vi.restoreAllMocks();
  });

  it("returns an empty array when history is missing", () => {
    expect(getHistory()).toEqual([]);
  });

  it("returns an empty array for invalid stored data", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, "not-json");

    expect(getHistory()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
  });

  it("returns an empty array for non-array stored data", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify({ id: "feed-1" }));

    expect(getHistory()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
  });

  it("cleans oversized raw history before parsing it", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, `"${"x".repeat(MAX_COMMAND_HISTORY_STORAGE_LENGTH + 1)}"`);

    expect(getHistory()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
  });

  it("removes oversized history payloads before parsing JSON", () => {
    const oversizedPayload = `[${" ".repeat(MAX_COMMAND_HISTORY_STORAGE_LENGTH)}]`;
    const parseSpy = vi.spyOn(JSON, "parse");

    localStorage.setItem(STORAGE_KEYS.commandHistory, oversizedPayload);

    expect(getHistory()).toEqual([]);
    expect(parseSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
  });

  it("discards non-string and blank entries from stored history", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify(["feed:feed-1", null, { kind: "feed", id: "feed-2" }, 1, "", "   ", "action:open-settings"]),
    );

    expect(getHistory()).toEqual(["feed:feed-1", "action:open-settings"]);
  });

  it("caps oversized stored history before exposing it to the UI", () => {
    const entries = Array.from({ length: MAX_COMMAND_HISTORY + 25 }, (_, index) => `item-${index}`);
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(entries));

    expect(getHistory()).toEqual(entries.slice(0, MAX_COMMAND_HISTORY));
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
      JSON.stringify(["feed:feed-1", null, "", "feed:feed-2", { id: "feed-3" }, "tag:tag-1"]),
    );

    addToHistory("feed:feed-2");

    expect(getHistory()).toEqual(["feed:feed-2", "feed:feed-1", "tag:tag-1"]);
  });

  it("cleans corrupted stored history during read", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify(["feed:feed-1", null, "", "   ", "tag:tag-1", { id: "feed-2" }]),
    );

    expect(getHistory()).toEqual(["feed:feed-1", "tag:tag-1"]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(["feed:feed-1", "tag:tag-1"]));
  });

  it("does not add blank history ids and cleans existing blank entries", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["feed:feed-1", "", "tag:tag-1"]));

    addToHistory("   ");

    expect(getHistory()).toEqual(["feed:feed-1", "tag:tag-1"]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(["feed:feed-1", "tag:tag-1"]));
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

  it("normalizes the new history id before de-duplicating and persisting", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["feed:feed-1", "action:open-settings"]));

    addToHistory(" feed:feed-1\u0000 ");

    expect(getHistory()).toEqual(["feed:feed-1", "action:open-settings"]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(
      JSON.stringify(["feed:feed-1", "action:open-settings"]),
    );
  });

  it("normalizes stored history against existing command palette resources", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify([
        "feed:feed-1",
        "tag:deleted-tag",
        "article:art-1",
        "action:missing-action",
        "feed:feed-1",
        "action:open-settings",
      ]),
    );

    const normalized = normalizeCommandHistoryForExistingEntries(
      new Set(["feed:feed-1", "article:art-1", "action:open-settings"]),
    );

    expect(normalized).toEqual(["feed:feed-1", "article:art-1", "action:open-settings"]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(
      JSON.stringify(["feed:feed-1", "article:art-1", "action:open-settings"]),
    );
  });

  it("projects history against existing command palette resources without writing storage", () => {
    localStorage.setItem(
      STORAGE_KEYS.commandHistory,
      JSON.stringify(["feed:feed-1", "tag:deleted-tag", "action:open-settings"]),
    );
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const projected = projectCommandHistoryForExistingEntries(getHistory(), new Set(["feed:feed-1"]));

    expect(projected).toEqual(["feed:feed-1"]);
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(
      JSON.stringify(["feed:feed-1", "tag:deleted-tag", "action:open-settings"]),
    );
    expect(setItem).not.toHaveBeenCalled();
  });

  it("writes projected resource history from an explicit effect boundary call", () => {
    const previous = ["feed:feed-1", "tag:deleted-tag", "feed:feed-1", "action:open-settings"];
    const next = ["feed:feed-1", "action:open-settings"];
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(previous));

    writeNormalizedHistoryAfterResourceProjection(previous, next);

    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(next));
  });

  it("returns normalized resource history in memory when resource cleanup write fails", () => {
    localStorage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(["feed:feed-1", "tag:deleted-tag"]));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(normalizeCommandHistoryForExistingEntries(new Set(["feed:feed-1"]))).toEqual(["feed:feed-1"]);
    expect(warn).toHaveBeenCalledWith("Failed to normalize command history in localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
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

  it("warns once while repeated storage writes fail", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => addToHistory("feed-1")).not.toThrow();
    expect(() => addToHistory("feed-2")).not.toThrow();
    expect(getHistory()).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Failed to write command history to localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("redacts storage failure diagnostic details", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded for https://example.com/path/token-abc?secret=123#frag TOKEN=abc123");
    });

    addToHistory("feed-1");

    expect(warn).toHaveBeenCalledWith(
      "Failed to write command history to localStorage.",
      expect.objectContaining({
        message: "quota exceeded for https://example.com/redacted?redacted#redacted TOKEN=<redacted>",
      }),
    );
  });

  it("can reset command history warning once cache between recovery checks", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    addToHistory("feed-1");
    addToHistory("feed-2");

    expect(warn).toHaveBeenCalledWith("Failed to write command history to localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockClear();

    resetCommandHistoryStorageFailureWarnings();
    resetRuntimeDiagnosticOnceSuppressionForTests();
    addToHistory("feed-3");

    expect(warn).toHaveBeenCalledWith("Failed to write command history to localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns once while repeated storage reads fail", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => getHistory()).not.toThrow();
    expect(getHistory()).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Failed to read command history from localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns once while repeated localStorage getter access fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage getter unavailable");
    });

    expect(getHistory()).toEqual([]);
    expect(() => addToHistory("feed-1")).not.toThrow();
    expect(() => clearHistory()).not.toThrow();
    expect(warn).toHaveBeenCalledWith("Command history localStorage is unavailable.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("fails safely when storage clear throws", () => {
    addToHistory("feed-1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => clearHistory()).not.toThrow();
    expect(getHistory()).toEqual(["feed-1"]);
    expect(warn).toHaveBeenCalledWith("Failed to clear command history from localStorage.", expect.any(Error));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
