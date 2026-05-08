import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteHandlers as createCommandPaletteHandlers } from "@/components/reader/hooks/command-palette/use-command-palette-handlers";
import { STORAGE_KEYS } from "@/constants/storage";

function expectCommandHistory(entries: string[]) {
  expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(entries));
}

function createHandlers(overrides: Partial<Parameters<typeof createCommandPaletteHandlers>[0]> = {}) {
  return createCommandPaletteHandlers({
    closePalette: vi.fn(),
    openShortcutsHelp: vi.fn(),
    showToast: vi.fn(),
    selectedAccountId: "acc-1",
    isSyncing: false,
    selectFeedFromCurrentContext: vi.fn(),
    selectTagFromCurrentContext: vi.fn(),
    selectArticle: vi.fn(),
    openFeedLanding: vi.fn(),
    ...overrides,
  });
}

describe("useCommandPaletteHandlers resource history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records feed history before landing navigation and preserves it when landing fails", async () => {
    const closePalette = vi.fn();
    const showToast = vi.fn();
    const openFeedLanding = vi.fn(async () => {
      expectCommandHistory(["feed:feed-1"]);
      throw new Error("boom");
    });
    const handlers = createHandlers({ closePalette, showToast, openFeedLanding });

    handlers.handleFeedSelect("feed-1");

    expect(openFeedLanding).toHaveBeenCalledWith("feed-1");
    expect(closePalette).toHaveBeenCalledTimes(1);
    expectCommandHistory(["feed:feed-1"]);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to open feed "feed-1": boom');
    });
    expectCommandHistory(["feed:feed-1"]);
  });

  it("records tag and article resource history before selection and closes after navigation", () => {
    const closePalette = vi.fn();
    const selectTagFromCurrentContext = vi.fn(() => {
      expectCommandHistory(["tag:tag-1"]);
    });
    const selectFeedFromCurrentContext = vi.fn(() => {
      expectCommandHistory(["article:art-1"]);
    });
    const selectArticle = vi.fn(() => {
      expectCommandHistory(["article:art-1"]);
    });
    const handlers = createHandlers({
      closePalette,
      selectFeedFromCurrentContext,
      selectTagFromCurrentContext,
      selectArticle,
    });

    handlers.handleTagSelect("tag-1");

    expect(selectTagFromCurrentContext).toHaveBeenCalledWith("tag-1");
    expect(closePalette).toHaveBeenCalledTimes(1);
    expect(selectTagFromCurrentContext.mock.invocationCallOrder[0]).toBeLessThan(
      closePalette.mock.invocationCallOrder[0] ?? 0,
    );

    closePalette.mockClear();
    localStorage.clear();
    handlers.handleArticleSelect("feed-1", "art-1");

    expect(selectFeedFromCurrentContext).toHaveBeenCalledWith("feed-1");
    expect(selectArticle).toHaveBeenCalledWith("art-1");
    expect(closePalette).toHaveBeenCalledTimes(1);
    expect(selectArticle.mock.invocationCallOrder[0]).toBeLessThan(closePalette.mock.invocationCallOrder[0] ?? 0);
  });
});
