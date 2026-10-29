import { act, cleanup, renderHook } from "@testing-library/react";
import { mountMotionFolder, mountMotionRow } from "@tests/helpers/feed-move-motion-dom";
import { flushTestMutationObservers } from "@tests/setup";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFeedMoveMotion } from "@/components/reader/hooks/sidebar/use-feed-move-motion";
import { FEED_MOVE_FEED_ROW_ATTRIBUTE } from "@/lib/sidebar/feed-move-animation";

// a1 sits in alpha above a2; moving it to bravo pulls a2 and bravo's header up by one row.
function setupTree() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const alpha = mountMotionFolder(container, "alpha", 0);
  const a1 = mountMotionRow(alpha.panel, FEED_MOVE_FEED_ROW_ATTRIBUTE, "a1", 20);
  const a2 = mountMotionRow(alpha.panel, FEED_MOVE_FEED_ROW_ATTRIBUTE, "a2", 40);
  const bravo = mountMotionFolder(container, "bravo", 60);
  const applyMove = () => {
    bravo.panel.prepend(a1.element);
    a2.setTop(20);
    bravo.header.setTop(40);
    a1.setTop(60);
  };
  return { container, a1, a2, bravo, applyMove };
}

function renderMotion(
  tree: ReturnType<typeof setupTree>,
  overrides: { moveFeedToFolder?: (feedId: string, folderId: string) => Promise<unknown>; scopeKey?: string } = {},
) {
  const moveFeedToFolder = overrides.moveFeedToFolder ?? vi.fn(() => Promise.resolve(null));
  const moveFeedToUnfoldered = vi.fn(() => Promise.resolve(null));
  const containerRef = { current: tree.container };
  const hook = renderHook(
    ({ scopeKey }) => useFeedMoveMotion({ containerRef, scopeKey, moveFeedToFolder, moveFeedToUnfoldered }),
    { initialProps: { scopeKey: overrides.scopeKey ?? "acc-1:all" } },
  );
  return { ...hook, moveFeedToFolder };
}

function pressKey(key: string) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("useFeedMoveMotion", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("animates the surrounding rows once the submitted move reaches the tree", async () => {
    const tree = setupTree();
    const { result, moveFeedToFolder } = renderMotion(tree);

    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    expect(moveFeedToFolder).toHaveBeenCalledWith("a1", "bravo");
    tree.applyMove();
    flushTestMutationObservers();

    expect(tree.a2.animate).toHaveBeenCalledTimes(1);
    expect(tree.bravo.header.animate).toHaveBeenCalledTimes(1);
    expect(tree.a1.animate).toHaveBeenCalledTimes(1);
  });

  it("captures positions before the move is submitted", async () => {
    const tree = setupTree();
    const moveFeedToFolder = vi.fn(() => {
      tree.applyMove();
      return Promise.resolve(null);
    });
    const { result } = renderMotion(tree, { moveFeedToFolder });

    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    flushTestMutationObservers();

    expect(tree.a2.animate).toHaveBeenCalledTimes(1);
  });

  it("does not animate a move activated from the keyboard", async () => {
    const tree = setupTree();
    const { result } = renderMotion(tree);

    pressKey("Enter");
    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    tree.applyMove();
    flushTestMutationObservers();

    expect(tree.a2.animate).not.toHaveBeenCalled();
    expect(tree.a1.animate).not.toHaveBeenCalled();
  });

  it("animates again once the pointer is used after a keyboard activation", async () => {
    const tree = setupTree();
    const { result } = renderMotion(tree);

    pressKey("Enter");
    document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    tree.applyMove();
    flushTestMutationObservers();

    expect(tree.a2.animate).toHaveBeenCalledTimes(1);
  });

  it("drops the snapshot and rethrows when the move fails before the tree changes", async () => {
    const tree = setupTree();
    const failure = new Error("update failed");
    const { result } = renderMotion(tree, { moveFeedToFolder: () => Promise.reject(failure) });

    await act(async () => {
      await expect(result.current.moveFeedToFolder("a1", "bravo")).rejects.toBe(failure);
    });
    tree.applyMove();
    flushTestMutationObservers();

    expect(tree.a2.animate).not.toHaveBeenCalled();
  });

  it("cancels the running motion when the move fails after the tree changed", async () => {
    const tree = setupTree();
    const failure = new Error("update failed");
    const moveFeedToFolder = vi.fn(async () => {
      tree.applyMove();
      flushTestMutationObservers();
      throw failure;
    });
    const { result } = renderMotion(tree, { moveFeedToFolder });

    await act(async () => {
      await expect(result.current.moveFeedToFolder("a1", "bravo")).rejects.toBe(failure);
    });

    expect(tree.a2.animate).toHaveBeenCalledTimes(1);
    expect(tree.a2.cancel).toHaveBeenCalledTimes(1);
  });

  it("does not carry a previous move's snapshot or running motion into the next one", async () => {
    const tree = setupTree();
    const { result } = renderMotion(tree);

    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    tree.applyMove();
    flushTestMutationObservers();
    expect(tree.a2.cancel).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.moveFeedToFolder("a2", "bravo");
    });

    expect(tree.a2.cancel).toHaveBeenCalledTimes(1);
    expect(tree.bravo.header.cancel).toHaveBeenCalledTimes(1);
  });

  it("does not play a move that lands after the scope changed", async () => {
    const tree = setupTree();
    const { result, rerender } = renderMotion(tree);

    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    rerender({ scopeKey: "acc-2:all" });
    tree.applyMove();
    flushTestMutationObservers();

    expect(tree.a2.animate).not.toHaveBeenCalled();
  });

  it("does not play a move that lands after unmount", async () => {
    const tree = setupTree();
    const { result, unmount } = renderMotion(tree);

    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    unmount();
    tree.applyMove();
    flushTestMutationObservers();

    expect(tree.a2.animate).not.toHaveBeenCalled();
  });

  it("does not play a move once the list has scrolled", async () => {
    const tree = setupTree();
    const { result } = renderMotion(tree);

    await act(async () => {
      await result.current.moveFeedToFolder("a1", "bravo");
    });
    tree.container.scrollTop = 30;
    tree.applyMove();
    flushTestMutationObservers();

    expect(tree.a2.animate).not.toHaveBeenCalled();
  });
});
