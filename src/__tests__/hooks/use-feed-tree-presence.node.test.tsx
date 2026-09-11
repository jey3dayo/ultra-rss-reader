import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createModernMatchMedia } from "@tests/helpers/match-media";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "@/components/reader/feed-tree.types";
import {
  buildLogicalMaps,
  computeNextState,
  EMPTY_LOGICAL_MAPS,
  EMPTY_STATE,
  presenceStatesEquivalent,
  useFeedTreePresence,
} from "@/components/reader/hooks/sidebar/use-feed-tree-presence";
import { MOTION_SIDEBAR_ROW_EXIT_DURATION_MS } from "@/constants";

setupBrowserTestDom();

// IMPORTANT: every array passed as `folders` / `unfolderedFeeds` below is
// constructed once, outside the `renderHook` callback. The callback re-runs
// on every re-render, including ones the hook triggers itself; an inline
// `[]` or `[a, b]` literal inside the callback body would be a *new* array
// reference on each such re-render. The hook itself tolerates that (its
// internal state never mirrors live view models, so an unstable reference
// with unchanged content converges to a no-op instead of looping), but
// building the test this way keeps the fixtures realistic and matches how
// `useSidebarFeedTree` actually supplies these arrays (memoized).
const NO_FOLDERS: FeedTreeFolderViewModel[] = [];
const NO_FEEDS: FeedTreeFeedViewModel[] = [];

function stubReducedMotion(matches: boolean) {
  const reducedMotionQuery = createModernMatchMedia(matches, "(prefers-reduced-motion: reduce)");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) =>
      query === "(prefers-reduced-motion: reduce)" ? reducedMotionQuery : createModernMatchMedia(false, query),
  });
  return reducedMotionQuery;
}

function makeFeed(overrides: Partial<FeedTreeFeedViewModel> = {}): FeedTreeFeedViewModel {
  return {
    id: "feed-1",
    accountId: "account-1",
    folderId: null,
    title: "Feed",
    url: "https://example.com/feed.xml",
    siteUrl: "https://example.com",
    iconUrl: null,
    unreadCount: 0,
    readerMode: "inherit",
    webPreviewMode: "inherit",
    isSelected: false,
    grayscaleFavicon: false,
    ...overrides,
  };
}

function makeFolder(
  overrides: Partial<Omit<FeedTreeFolderViewModel, "feeds">> = {},
  feeds: FeedTreeFeedViewModel[] = NO_FEEDS,
): FeedTreeFolderViewModel {
  return {
    id: "folder-1",
    name: "Folder",
    accountId: "account-1",
    sortOrder: 0,
    unreadCount: 0,
    isExpanded: true,
    isSelected: false,
    feeds,
    ...overrides,
  };
}

describe("useFeedTreePresence", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined });
  });

  it("passes through the logical tree with isLeaving false", () => {
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const initialFeeds = [feedA, feedB];

    const { result } = renderHook(() =>
      useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds: initialFeeds, scopeKey: "account-1" }),
    );

    expect(result.current.unfolderedFeeds.map((feed) => [feed.id, feed.isLeaving])).toEqual([
      ["feed-a", false],
      ["feed-b", false],
    ]);
  });

  it("retains a feed removed from the logical tree at its prior position with isLeaving true", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const feedC = makeFeed({ id: "feed-c" });
    const withAllThree = [feedA, feedB, feedC];
    const withoutB = [feedA, feedC];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withAllThree } },
    );

    act(() => {
      rerender({ unfolderedFeeds: withoutB });
    });

    expect(result.current.unfolderedFeeds.map((feed) => [feed.id, feed.isLeaving])).toEqual([
      ["feed-a", false],
      ["feed-b", true],
      ["feed-c", false],
    ]);
  });

  it("drops the retained feed once the exit duration elapses", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withBoth } },
    );

    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });
    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a", "feed-b"]);

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });

    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains a folder and its last child together when the folder disappears from the logical tree", () => {
    vi.useFakeTimers();
    const childFeed = makeFeed({ id: "child-feed" });
    const folder = makeFolder({ id: "folder-a" }, [childFeed]);
    const withFolder = [folder];

    const { result, rerender } = renderHook(
      ({ folders }: { folders: FeedTreeFolderViewModel[] }) =>
        useFeedTreePresence({ folders, unfolderedFeeds: NO_FEEDS, scopeKey: "account-1" }),
      { initialProps: { folders: withFolder } },
    );

    act(() => {
      rerender({ folders: NO_FOLDERS });
    });

    expect(result.current.folders).toHaveLength(1);
    expect(result.current.folders[0]?.id).toBe("folder-a");
    expect(result.current.folders[0]?.isLeaving).toBe(true);
    expect(result.current.folders[0]?.feeds).toHaveLength(1);
    expect(result.current.folders[0]?.feeds[0]?.id).toBe("child-feed");
    expect(result.current.folders[0]?.feeds[0]?.isLeaving).toBe(true);

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });

    expect(result.current.folders).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the display tree non-empty while retained rows are still leaving even though the logical tree is empty", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const withA = [feedA];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withA } },
    );

    act(() => {
      rerender({ unfolderedFeeds: NO_FEEDS });
    });

    expect(result.current.folders).toHaveLength(0);
    expect(result.current.unfolderedFeeds).toHaveLength(1);
    expect(result.current.unfolderedFeeds[0]?.isLeaving).toBe(true);
  });

  it("retains a sibling feed inside a folder that itself stays logically present", () => {
    vi.useFakeTimers();
    const stayingFeed = makeFeed({ id: "staying-feed" });
    const leavingFeed = makeFeed({ id: "leaving-feed" });
    const withBothChildren = [makeFolder({ id: "folder-a" }, [stayingFeed, leavingFeed])];
    const withOnlyStaying = [makeFolder({ id: "folder-a" }, [stayingFeed])];

    const { result, rerender } = renderHook(
      ({ folders }: { folders: FeedTreeFolderViewModel[] }) =>
        useFeedTreePresence({ folders, unfolderedFeeds: NO_FEEDS, scopeKey: "account-1" }),
      { initialProps: { folders: withBothChildren } },
    );

    act(() => {
      rerender({ folders: withOnlyStaying });
    });

    expect(result.current.folders).toHaveLength(1);
    expect(result.current.folders[0]?.isLeaving).toBe(false);
    expect(result.current.folders[0]?.feeds.map((feed) => [feed.id, feed.isLeaving])).toEqual([
      ["staying-feed", false],
      ["leaving-feed", true],
    ]);

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });

    expect(result.current.folders[0]?.isLeaving).toBe(false);
    expect(result.current.folders[0]?.feeds.map((feed) => feed.id)).toEqual(["staying-feed"]);
  });

  it("cancels the pending timer and resets isLeaving when a retained feed reappears with the same id", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withBoth } },
    );

    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });
    expect(result.current.unfolderedFeeds.find((feed) => feed.id === "feed-b")?.isLeaving).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    clearTimeoutSpy.mockClear();

    act(() => {
      rerender({ unfolderedFeeds: withBoth });
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.unfolderedFeeds.map((feed) => [feed.id, feed.isLeaving])).toEqual([
      ["feed-a", false],
      ["feed-b", false],
    ]);

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });

    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a", "feed-b"]);
  });

  it("does not let a cancelled leave timer fire after the row leaves again with a later deadline", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];
    const half = MOTION_SIDEBAR_ROW_EXIT_DURATION_MS / 2;

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withBoth } },
    );

    // First leave at t=0: schedules a timer with deadline t=DURATION.
    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });

    // Advance partway, then reappear: cancels that timer.
    act(() => {
      vi.advanceTimersByTime(half);
    });
    act(() => {
      rerender({ unfolderedFeeds: withBoth });
    });
    expect(vi.getTimerCount()).toBe(0);

    // Leave again at t=DURATION/2: schedules a fresh timer whose deadline
    // (t=1.5*DURATION) is strictly later than the cancelled timer's original
    // deadline (t=DURATION). If the cancellation were broken, the row would
    // vanish at t=DURATION instead of t=1.5*DURATION.
    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });
    expect(vi.getTimerCount()).toBe(1);
    expect(result.current.unfolderedFeeds.find((feed) => feed.id === "feed-b")?.isLeaving).toBe(true);

    // Reach t=DURATION: the original (cancelled) deadline. The row must
    // still be present.
    act(() => {
      vi.advanceTimersByTime(half);
    });
    expect(result.current.unfolderedFeeds.find((feed) => feed.id === "feed-b")).toBeDefined();

    // Reach t=1.5*DURATION: the current timer's own deadline.
    act(() => {
      vi.advanceTimersByTime(half);
    });
    expect(result.current.unfolderedFeeds.find((feed) => feed.id === "feed-b")).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("discards retained rows immediately when scopeKey changes", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds, scopeKey }: { unfolderedFeeds: FeedTreeFeedViewModel[]; scopeKey: string }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey }),
      { initialProps: { unfolderedFeeds: withBoth, scopeKey: "account-1" } },
    );

    act(() => {
      rerender({ unfolderedFeeds: withOnlyA, scopeKey: "account-1" });
    });
    expect(result.current.unfolderedFeeds).toHaveLength(2);

    act(() => {
      rerender({ unfolderedFeeds: withOnlyA, scopeKey: "account-2" });
    });

    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a"]);
    expect(vi.getTimerCount()).toBe(0);

    // The retained "feed-b" timer must not resurrect it after the scope reset.
    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });
    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a"]);
  });

  it("never mixes the previous scope's retained rows into any rendered frame right after scopeKey changes", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const frames: string[][] = [];
    const { rerender } = renderHook(
      ({ unfolderedFeeds, scopeKey }: { unfolderedFeeds: FeedTreeFeedViewModel[]; scopeKey: string }) => {
        const out = useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey });
        frames.push(out.unfolderedFeeds.map((feed) => feed.id));
        return out;
      },
      { initialProps: { unfolderedFeeds: withBoth, scopeKey: "account-1" } },
    );

    // "feed-b" starts leaving, still within scope "account-1".
    act(() => {
      rerender({ unfolderedFeeds: withOnlyA, scopeKey: "account-1" });
    });

    frames.length = 0;
    // Switch scope. The new scope only ever supplied "feed-a" — "feed-b" (a
    // retention carried over from the OLD scope) must never appear in ANY
    // rendered frame here, including the render that happens before the
    // layout effect resets `state` to the new scope. Comparing `scopeKey`
    // only inside the layout effect (e.g. via a ref updated there) would
    // leak "feed-b" into exactly that one render.
    act(() => {
      rerender({ unfolderedFeeds: withOnlyA, scopeKey: "account-2" });
    });

    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame).toEqual(["feed-a"]);
    }
  });

  it("reuses the same feed id cleanly across scope A -> B -> A without leaking A's first retention", () => {
    vi.useFakeTimers();
    const feed = makeFeed({ id: "feed-x" });
    const other = makeFeed({ id: "feed-y" });
    const withBoth = [feed, other];
    const withOnlyOther = [other];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds, scopeKey }: { unfolderedFeeds: FeedTreeFeedViewModel[]; scopeKey: string }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey }),
      { initialProps: { unfolderedFeeds: withBoth, scopeKey: "A" } },
    );

    // In scope A, "feed-x" starts leaving.
    act(() => {
      rerender({ unfolderedFeeds: withOnlyOther, scopeKey: "A" });
    });
    expect(result.current.unfolderedFeeds.find((f) => f.id === "feed-x")?.isLeaving).toBe(true);

    // Switch to scope B: the retained "feed-x" and its timer must be gone.
    act(() => {
      rerender({ unfolderedFeeds: withOnlyOther, scopeKey: "B" });
    });
    expect(result.current.unfolderedFeeds.map((f) => f.id)).toEqual(["feed-y"]);
    expect(vi.getTimerCount()).toBe(0);

    // Switch back to scope A with "feed-x" present again: it must render as
    // a plain logical row, not as a leftover leaving row from before.
    act(() => {
      rerender({ unfolderedFeeds: withBoth, scopeKey: "A" });
    });
    expect(result.current.unfolderedFeeds.map((f) => [f.id, f.isLeaving])).toEqual([
      ["feed-x", false],
      ["feed-y", false],
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("moves a feed between folders and to unfoldered without ever marking it as leaving", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "a" });
    const feedB = makeFeed({ id: "b" });
    const movingFeed = makeFeed({ id: "moving" });

    const step1Folders = [makeFolder({ id: "folder-a" }, [feedA, movingFeed]), makeFolder({ id: "folder-b" }, [feedB])];
    const step2Folders = [makeFolder({ id: "folder-a" }, [feedA]), makeFolder({ id: "folder-b" }, [feedB, movingFeed])];
    const step3Folders = [makeFolder({ id: "folder-a" }, [feedA]), makeFolder({ id: "folder-b" }, [feedB])];

    const { result, rerender } = renderHook(
      ({
        folders,
        unfolderedFeeds,
      }: {
        folders: FeedTreeFolderViewModel[];
        unfolderedFeeds: FeedTreeFeedViewModel[];
      }) => useFeedTreePresence({ folders, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { folders: step1Folders, unfolderedFeeds: NO_FEEDS } },
    );

    // Move "moving" from folder-a to folder-b.
    act(() => {
      rerender({ folders: step2Folders, unfolderedFeeds: NO_FEEDS });
    });
    expect(result.current.folders.find((f) => f.id === "folder-a")?.feeds.map((f) => f.id)).toEqual(["a"]);
    expect(result.current.folders.find((f) => f.id === "folder-b")?.feeds.map((f) => [f.id, f.isLeaving])).toEqual([
      ["b", false],
      ["moving", false],
    ]);
    expect(vi.getTimerCount()).toBe(0);

    // Move "moving" from folder-b to unfoldered.
    act(() => {
      rerender({ folders: step3Folders, unfolderedFeeds: [movingFeed] });
    });
    expect(result.current.folders.find((f) => f.id === "folder-b")?.feeds.map((f) => f.id)).toEqual(["b"]);
    expect(result.current.unfolderedFeeds.map((f) => [f.id, f.isLeaving])).toEqual([["moving", false]]);
    expect(vi.getTimerCount()).toBe(0);

    // Nothing was ever scheduled, so letting time pass changes nothing, and
    // there is no residue anywhere.
    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });
    expect(result.current.folders.find((f) => f.id === "folder-a")?.feeds.map((f) => f.id)).toEqual(["a"]);
    expect(result.current.folders.find((f) => f.id === "folder-b")?.feeds.map((f) => f.id)).toEqual(["b"]);
    expect(result.current.unfolderedFeeds.map((f) => f.id)).toEqual(["moving"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("moves a feed from unfoldered into a folder and then to another folder without ever marking it as leaving", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "a" });
    const feedB = makeFeed({ id: "b" });
    const movingFeed = makeFeed({ id: "moving" });

    const step1Folders = [makeFolder({ id: "folder-a" }, [feedA]), makeFolder({ id: "folder-b" }, [feedB])];
    const step2Folders = [makeFolder({ id: "folder-a" }, [feedA, movingFeed]), makeFolder({ id: "folder-b" }, [feedB])];
    const step3Folders = [makeFolder({ id: "folder-a" }, [feedA]), makeFolder({ id: "folder-b" }, [feedB, movingFeed])];

    const { result, rerender } = renderHook(
      ({
        folders,
        unfolderedFeeds,
      }: {
        folders: FeedTreeFolderViewModel[];
        unfolderedFeeds: FeedTreeFeedViewModel[];
      }) => useFeedTreePresence({ folders, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { folders: step1Folders, unfolderedFeeds: [movingFeed] } },
    );

    // Move "moving" from unfoldered into folder-a.
    act(() => {
      rerender({ folders: step2Folders, unfolderedFeeds: NO_FEEDS });
    });
    expect(result.current.unfolderedFeeds).toHaveLength(0);
    expect(result.current.folders.find((f) => f.id === "folder-a")?.feeds.map((f) => [f.id, f.isLeaving])).toEqual([
      ["a", false],
      ["moving", false],
    ]);
    expect(vi.getTimerCount()).toBe(0);

    // Move "moving" from folder-a to folder-b.
    act(() => {
      rerender({ folders: step3Folders, unfolderedFeeds: NO_FEEDS });
    });
    expect(result.current.folders.find((f) => f.id === "folder-a")?.feeds.map((f) => f.id)).toEqual(["a"]);
    expect(result.current.folders.find((f) => f.id === "folder-b")?.feeds.map((f) => [f.id, f.isLeaving])).toEqual([
      ["b", false],
      ["moving", false],
    ]);
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });
    expect(result.current.folders.find((f) => f.id === "folder-a")?.feeds.map((f) => f.id)).toEqual(["a"]);
    expect(result.current.folders.find((f) => f.id === "folder-b")?.feeds.map((f) => f.id)).toEqual(["b", "moving"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never omits a leaving row from any rendered frame while it transitions to leaving", () => {
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const frames: string[][] = [];
    const { rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) => {
        const out = useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" });
        frames.push(out.unfolderedFeeds.map((feed) => feed.id));
        return out;
      },
      { initialProps: { unfolderedFeeds: withBoth } },
    );

    frames.length = 0;
    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });

    expect(frames.length).toBeGreaterThan(0);
    // Every single rendered frame during this transition must still contain
    // "feed-b": if any frame is missing it, React actually unmounted that
    // row's element and a later frame remounted a fresh one, destroying its
    // transition history — the whole point of retaining it.
    for (const frame of frames) {
      expect(frame).toContain("feed-b");
    }
  });

  it("keeps a still-logical feed's metadata current every render, independent of the diff effect", () => {
    vi.useFakeTimers();
    const feedV1 = makeFeed({ id: "feed-a", unreadCount: 3, isSelected: false });
    const feedV2 = makeFeed({ id: "feed-a", unreadCount: 7, isSelected: true });

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: [feedV1] } },
    );

    expect(result.current.unfolderedFeeds[0]).toMatchObject({ unreadCount: 3, isSelected: false, isLeaving: false });

    act(() => {
      rerender({ unfolderedFeeds: [feedV2] });
    });

    // Same id, changed metadata: this must never be read as "the row left
    // and a new one arrived" (isLeaving must stay false, no timer scheduled)
    // and the updated fields must be visible immediately, without depending
    // on whether the diff effect ran.
    expect(result.current.unfolderedFeeds[0]).toMatchObject({ unreadCount: 7, isSelected: true, isLeaving: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a revived folder's stale child retained until its own timer expires, alongside the folder's new child", () => {
    vi.useFakeTimers();
    const oldChild = makeFeed({ id: "old-child" });
    const newChild = makeFeed({ id: "new-child" });
    const withOldChild = [makeFolder({ id: "folder-a" }, [oldChild])];
    const withNewChild = [makeFolder({ id: "folder-a" }, [newChild])];

    const { result, rerender } = renderHook(
      ({ folders }: { folders: FeedTreeFolderViewModel[] }) =>
        useFeedTreePresence({ folders, unfolderedFeeds: NO_FEEDS, scopeKey: "account-1" }),
      { initialProps: { folders: withOldChild } },
    );

    // Folder (and its only child) disappear together.
    act(() => {
      rerender({ folders: NO_FOLDERS });
    });
    expect(result.current.folders[0]?.isLeaving).toBe(true);
    expect(result.current.folders[0]?.feeds.map((f) => f.id)).toEqual(["old-child"]);

    // Folder reappears, but now with a different child; the old child is
    // still gone from everywhere, so it keeps leaving independently.
    act(() => {
      rerender({ folders: withNewChild });
    });
    expect(result.current.folders).toHaveLength(1);
    expect(result.current.folders[0]?.isLeaving).toBe(false);
    expect(result.current.folders[0]?.feeds.map((f) => [f.id, f.isLeaving])).toEqual([
      ["old-child", true],
      ["new-child", false],
    ]);

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });

    expect(result.current.folders).toHaveLength(1);
    expect(result.current.folders[0]?.isLeaving).toBe(false);
    expect(result.current.folders[0]?.feeds.map((f) => f.id)).toEqual(["new-child"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns the logical tree directly with no retained rows under prefers-reduced-motion: reduce", () => {
    stubReducedMotion(true);
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withBoth } },
    );

    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });

    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("collapses an in-progress retention and clears its timer when prefers-reduced-motion switches to reduce", () => {
    const reducedMotionQuery = stubReducedMotion(false);
    vi.useFakeTimers();
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const { result, rerender } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withBoth } },
    );

    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });
    expect(result.current.unfolderedFeeds.find((feed) => feed.id === "feed-b")?.isLeaving).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      reducedMotionQuery.dispatch(true);
    });

    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a"]);
    expect(vi.getTimerCount()).toBe(0);

    // The (now-cleared) timer firing later must not do anything odd.
    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    });
    expect(result.current.unfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-a"]);
  });

  it("clears all pending timers on unmount and does not fire after unmount", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const feedA = makeFeed({ id: "feed-a" });
    const feedB = makeFeed({ id: "feed-b" });
    const withBoth = [feedA, feedB];
    const withOnlyA = [feedA];

    const { result, rerender, unmount } = renderHook(
      ({ unfolderedFeeds }: { unfolderedFeeds: FeedTreeFeedViewModel[] }) =>
        useFeedTreePresence({ folders: NO_FOLDERS, unfolderedFeeds, scopeKey: "account-1" }),
      { initialProps: { unfolderedFeeds: withBoth } },
    );

    act(() => {
      rerender({ unfolderedFeeds: withOnlyA });
    });
    expect(result.current.unfolderedFeeds.find((feed) => feed.id === "feed-b")?.isLeaving).toBe(true);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    clearTimeoutSpy.mockClear();
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("computeNextState / presenceStatesEquivalent (pure diff convergence)", () => {
  it("converges to a no-op when the same logical content arrives as new view-model objects each time", () => {
    const MAX_ITERATIONS = 5;

    let logical = buildLogicalMaps(NO_FOLDERS, [makeFeed({ id: "feed-a" })]);
    let state = computeNextState(EMPTY_STATE, EMPTY_LOGICAL_MAPS, logical, true).nextState;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      // A brand-new feed object with identical field values every time —
      // simulating a caller that does not memoize its view models.
      const nextLogical = buildLogicalMaps(NO_FOLDERS, [makeFeed({ id: "feed-a" })]);
      const { nextState, instructions } = computeNextState(state, logical, nextLogical, true);

      expect(instructions).toEqual([]);
      expect(presenceStatesEquivalent(state, nextState)).toBe(true);

      state = nextState;
      logical = nextLogical;
    }
  });
});
