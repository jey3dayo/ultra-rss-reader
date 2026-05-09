import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScreenSnapshotResult } from "@/hooks/use-screen-snapshot";
import { adoptSnapshotByKey, useScreenSnapshot } from "@/hooks/use-screen-snapshot";

type SnapshotCandidate = { value: string };

type ScreenSnapshotHookProps = {
  candidate: SnapshotCandidate | null;
  canAdopt: boolean;
};

type ArticleSnapshotCandidate = {
  contextKey: string;
  articles: Array<{ id: string }>;
};

function renderScreenSnapshotHook(initialProps: ScreenSnapshotHookProps) {
  return renderHook(({ candidate, canAdopt }: ScreenSnapshotHookProps) => useScreenSnapshot(candidate, canAdopt), {
    initialProps,
  });
}

function expectSnapshotState<T>(result: ScreenSnapshotResult<T>, expected: ScreenSnapshotResult<T>) {
  expect(result.snapshot).toEqual(expected.snapshot);
  expect(result.hasResolvedSnapshot).toBe(expected.hasResolvedSnapshot);
  expect(result.hasAdoptedSnapshot).toBe(expected.hasAdoptedSnapshot);
}

describe("useScreenSnapshot", () => {
  it("adopts immediately on the initial render when canAdopt is true", () => {
    const { result } = renderHook(() => useScreenSnapshot({ value: "sqlite" }, true));

    expectSnapshotState(result.current, {
      snapshot: { value: "sqlite" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });
  });

  it("keeps the previous snapshot while the next fetch is pending", () => {
    const { result, rerender } = renderScreenSnapshotHook({
      candidate: null,
      canAdopt: false,
    });

    expectSnapshotState(result.current, {
      snapshot: null,
      hasResolvedSnapshot: false,
      hasAdoptedSnapshot: false,
    });

    rerender({
      candidate: { value: "sqlite" },
      canAdopt: true,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "sqlite" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });

    rerender({
      candidate: null,
      canAdopt: false,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "sqlite" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });
  });

  it("keeps the previous snapshot when the candidate changes while canAdopt is false", () => {
    const { result, rerender } = renderScreenSnapshotHook({
      candidate: { value: "first" },
      canAdopt: true,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "first" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });

    rerender({
      candidate: { value: "second" },
      canAdopt: false,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "first" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });
  });

  it("adopts the latest candidate when canAdopt toggles from false to true", () => {
    const { result, rerender } = renderScreenSnapshotHook({
      candidate: null,
      canAdopt: false,
    });

    expectSnapshotState(result.current, {
      snapshot: null,
      hasResolvedSnapshot: false,
      hasAdoptedSnapshot: false,
    });

    rerender({
      candidate: { value: "queued" },
      canAdopt: false,
    });

    expectSnapshotState(result.current, {
      snapshot: null,
      hasResolvedSnapshot: false,
      hasAdoptedSnapshot: false,
    });

    rerender({
      candidate: { value: "queued" },
      canAdopt: true,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "queued" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });
  });

  it("treats a null candidate as unresolved while canAdopt is true", () => {
    const { result, rerender } = renderScreenSnapshotHook({
      candidate: { value: "adopted" },
      canAdopt: true,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "adopted" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });

    rerender({
      candidate: null,
      canAdopt: true,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "adopted" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });
  });

  it("stays unresolved when canAdopt is true but no snapshot has been adopted yet", () => {
    const { result } = renderHook(() => useScreenSnapshot(null, true));

    expectSnapshotState(result.current, {
      snapshot: null,
      hasResolvedSnapshot: false,
      hasAdoptedSnapshot: false,
    });
  });

  it("does not adopt the initial candidate until canAdopt becomes true", () => {
    const { result, rerender } = renderScreenSnapshotHook({
      candidate: { value: "initial" },
      canAdopt: false,
    });

    expectSnapshotState(result.current, {
      snapshot: null,
      hasResolvedSnapshot: false,
      hasAdoptedSnapshot: false,
    });

    rerender({
      candidate: { value: "initial" },
      canAdopt: true,
    });

    expectSnapshotState(result.current, {
      snapshot: { value: "initial" },
      hasResolvedSnapshot: true,
      hasAdoptedSnapshot: true,
    });
  });

  it("adopts keyed snapshots only for the current first-screen context", () => {
    const snapshot = {
      accountId: "acc-1",
      feeds: [{ id: "feed-1" }],
    };

    expect(adoptSnapshotByKey(snapshot, "accountId", "acc-1")).toBe(snapshot);
    expect(adoptSnapshotByKey(snapshot, "accountId", "acc-2")).toBeNull();
    expect(adoptSnapshotByKey(snapshot, "accountId", null)).toBeNull();
    expect(adoptSnapshotByKey(null, "accountId", "acc-1")).toBeNull();
  });

  it("does not reuse a SQLite first-screen snapshot after the feed context changes", () => {
    const { result, rerender } = renderHook(
      ({
        candidate,
        canAdopt,
      }: {
        candidate: { contextKey: string; articles: Array<{ id: string }> } | null;
        canAdopt: boolean;
      }) => useScreenSnapshot(candidate, canAdopt),
      {
        initialProps: {
          candidate: { contextKey: "feed:feed-1:unread", articles: [{ id: "article-1" }] } as ArticleSnapshotCandidate,
          canAdopt: true,
        },
      },
    );
    const rerenderWithSnapshot = rerender as (props: {
      candidate: { contextKey: string; articles: Array<{ id: string }> } | null;
      canAdopt: boolean;
    }) => void;

    expect(adoptSnapshotByKey(result.current.snapshot, "contextKey", "feed:feed-1:unread")?.articles).toEqual([
      { id: "article-1" },
    ]);

    rerenderWithSnapshot({
      candidate: null,
      canAdopt: false,
    });

    expect(adoptSnapshotByKey(result.current.snapshot, "contextKey", "feed:feed-2:unread")).toBeNull();

    rerenderWithSnapshot({
      candidate: { contextKey: "feed:feed-2:unread", articles: [{ id: "article-2" }] },
      canAdopt: true,
    });

    expect(adoptSnapshotByKey(result.current.snapshot, "contextKey", "feed:feed-2:unread")?.articles).toEqual([
      { id: "article-2" },
    ]);
  });
});
