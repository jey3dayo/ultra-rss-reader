import { Result } from "@praha/byethrow";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteHandlers as createCommandPaletteHandlers } from "@/components/reader/hooks/command-palette/use-command-palette-handlers";
import { STORAGE_KEYS } from "@/constants/storage";
import type { FeedLandingResult } from "@/hooks/use-feed-landing";
import i18n from "@/lib/i18n";
import enReader from "@/locales/en/reader.json";

setupBrowserTestDom();

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function expectCommandHistory(entries: string[]) {
  expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBe(JSON.stringify(entries));
}

function createHandlers(overrides: Partial<Parameters<typeof createCommandPaletteHandlers>[0]> = {}) {
  const { result } = renderHook(() =>
    createCommandPaletteHandlers({
      closePalette: vi.fn(),
      openShortcutsHelp: vi.fn(),
      showToast: vi.fn(),
      selectedAccountId: "acc-1",
      isSyncing: false,
      selectFeedFromCurrentContext: vi.fn(),
      selectFolderFromCurrentContext: vi.fn(),
      selectTagFromCurrentContext: vi.fn(),
      selectArticle: vi.fn(),
      openFeedLanding: vi.fn(),
      paletteSessionId: 1,
      canSelectArticle: () => true,
      ...overrides,
    }),
  );
  return result.current;
}

describe("useCommandPaletteHandlers resource history", () => {
  beforeEach(async () => {
    if (!i18n.hasResourceBundle("en", "reader")) {
      i18n.addResourceBundle("en", "reader", enReader, true, true);
    }
    await i18n.changeLanguage("en");
    localStorage.clear();
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve) => setImmediate(resolve));
    vi.restoreAllMocks();
  });

  it("records feed history before landing navigation and preserves it when landing returns a failure result", async () => {
    const closePalette = vi.fn();
    const showToast = vi.fn();
    const openFeedLanding = vi.fn(async () => {
      expectCommandHistory(["feed:feed-1"]);
      return Result.fail({
        type: "landing_fetch_failed" as const,
        feedId: "feed-1",
        message: "boom",
      });
    });
    const handlers = createHandlers({
      closePalette,
      showToast,
      openFeedLanding,
    });

    handlers.handleFeedSelect("feed-1");

    expect(openFeedLanding).toHaveBeenCalledWith("feed-1");
    expect(closePalette).toHaveBeenCalledTimes(1);
    expectCommandHistory(["feed:feed-1"]);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to open feed "feed-1": boom');
    });
    expectCommandHistory(["feed:feed-1"]);
  });

  it("shows localized feed landing failures that do not come from fetch exceptions", async () => {
    const showToast = vi.fn();
    const openFeedLanding = vi.fn(async () =>
      Result.fail({
        type: "feed_not_found" as const,
        feedId: "missing-feed",
      }),
    );
    const handlers = createHandlers({ showToast, openFeedLanding });

    handlers.handleFeedSelect("missing-feed");

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to open feed "missing-feed": Feed not found.');
    });
  });

  it("ignores stale feed landing failures after an account switch or newer feed selection", async () => {
    const showToast = vi.fn();
    const staleLanding = createDeferred<FeedLandingResult>();
    const currentLanding = createDeferred<FeedLandingResult>();
    const openFeedLanding = vi
      .fn<(feedId: string) => Promise<FeedLandingResult>>()
      .mockReturnValueOnce(staleLanding.promise)
      .mockReturnValueOnce(currentLanding.promise);
    const { result, rerender } = renderHook(
      ({ selectedAccountId }: { selectedAccountId: string }) =>
        createCommandPaletteHandlers({
          closePalette: vi.fn(),
          openShortcutsHelp: vi.fn(),
          selectedAccountId,
          isSyncing: false,
          selectFeedFromCurrentContext: vi.fn(),
          selectFolderFromCurrentContext: vi.fn(),
          selectTagFromCurrentContext: vi.fn(),
          selectArticle: vi.fn(),
          showToast,
          openFeedLanding,
          paletteSessionId: 1,
          canSelectArticle: () => true,
        }),
      {
        initialProps: { selectedAccountId: "acc-1" },
      },
    );

    result.current.handleFeedSelect("feed-1");
    rerender({ selectedAccountId: "acc-2" });
    result.current.handleFeedSelect("feed-2");

    staleLanding.resolve(
      Result.fail({
        type: "landing_fetch_failed" as const,
        feedId: "feed-1",
        message: "old boom",
      }),
    );
    currentLanding.resolve(
      Result.fail({
        type: "landing_fetch_failed" as const,
        feedId: "feed-2",
        message: "new boom",
      }),
    );

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to open feed "feed-2": new boom');
    });
    expect(showToast).not.toHaveBeenCalledWith('Failed to open feed "feed-1": old boom');
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

  it("does not select, close, or write history for stale article selections", () => {
    const closePalette = vi.fn();
    const selectFeedFromCurrentContext = vi.fn();
    const selectArticle = vi.fn();
    const handlers = createHandlers({
      closePalette,
      selectFeedFromCurrentContext,
      selectArticle,
      canSelectArticle: () => false,
    });

    handlers.handleArticleSelect("stale-feed", "stale-article");

    expect(selectFeedFromCurrentContext).not.toHaveBeenCalled();
    expect(selectArticle).not.toHaveBeenCalled();
    expect(closePalette).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
  });

  it("does not select, close, or write history for stale tag selections", () => {
    const closePalette = vi.fn();
    const selectTagFromCurrentContext = vi.fn();
    const handlers = createHandlers({
      closePalette,
      selectTagFromCurrentContext,
      canSelectTag: () => false,
    });

    handlers.handleTagSelect("stale-tag");

    expect(selectTagFromCurrentContext).not.toHaveBeenCalled();
    expect(closePalette).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
  });

  it("records folder resource history before selection and closes after navigation", () => {
    const closePalette = vi.fn();
    const selectFolderFromCurrentContext = vi.fn(() => {
      expectCommandHistory(["folder:folder-1"]);
    });
    const handlers = createHandlers({
      closePalette,
      selectFolderFromCurrentContext,
    });

    handlers.handleFolderSelect("folder-1");

    expect(selectFolderFromCurrentContext).toHaveBeenCalledWith("folder-1");
    expect(closePalette).toHaveBeenCalledTimes(1);
    expect(selectFolderFromCurrentContext.mock.invocationCallOrder[0]).toBeLessThan(
      closePalette.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not select, close, or write history for stale folder selections", () => {
    const closePalette = vi.fn();
    const selectFolderFromCurrentContext = vi.fn();
    const handlers = createHandlers({
      closePalette,
      selectFolderFromCurrentContext,
      canSelectFolder: () => false,
    });

    handlers.handleFolderSelect("stale-folder");

    expect(selectFolderFromCurrentContext).not.toHaveBeenCalled();
    expect(closePalette).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.commandHistory)).toBeNull();
  });
});
