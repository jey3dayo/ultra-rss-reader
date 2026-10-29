import { mountMotionFeed, mountMotionFolder } from "@tests/helpers/feed-move-motion-dom";
import { flushTestMutationObservers } from "@tests/setup";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE } from "@/constants";
import {
  captureFeedMoveSnapshot,
  type FeedMoveSnapshot,
  playFeedMoveAnimation,
  watchFeedMoveAnimation,
} from "@/lib/sidebar/feed-move-animation";
import { FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS } from "@/lib/sidebar/folder-tree-reorder-animation";

function requireSnapshot(snapshot: FeedMoveSnapshot | null): FeedMoveSnapshot {
  if (!snapshot) {
    throw new Error("snapshot should be captured while the container exists");
  }
  return snapshot;
}

// Folder alpha holds a1 (the feed that will move) and a2; folder bravo holds b1; u1 is unfoldered.
function setupTree() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const alpha = mountMotionFolder(container, "alpha", 0);
  const a1 = mountMotionFeed(alpha.panel, "a1", 20);
  const a2 = mountMotionFeed(alpha.panel, "a2", 40);
  const bravo = mountMotionFolder(container, "bravo", 60);
  const b1 = mountMotionFeed(bravo.panel, "b1", 80);
  const unfoldered = document.createElement("div");
  container.appendChild(unfoldered);
  const u1 = mountMotionFeed(unfoldered, "u1", 100);
  return { container, alpha, a1, a2, bravo, b1, u1 };
}

function capture(container: HTMLElement, overrides: Partial<Parameters<typeof captureFeedMoveSnapshot>[0]> = {}) {
  return requireSnapshot(
    captureFeedMoveSnapshot({
      container,
      feedId: "a1",
      destinationFolderId: "bravo",
      scopeKey: "acc-1:all",
      now: 1000,
      ...overrides,
    }),
  );
}

// a1 leaves alpha for the top of bravo: alpha shrinks by one row, bravo grows by one.
function applyMoveToBravo(tree: ReturnType<typeof setupTree>) {
  tree.bravo.panel.prepend(tree.a1.element);
  tree.a2.setTop(20);
  tree.bravo.header.setTop(40);
  tree.a1.setTop(60);
  tree.a1.button.setTop(60);
  tree.b1.setTop(80);
  tree.u1.setTop(100);
}

function play(
  container: HTMLElement,
  snapshot: FeedMoveSnapshot,
  overrides: Partial<Parameters<typeof playFeedMoveAnimation>[0]> = {},
) {
  return playFeedMoveAnimation({
    container,
    snapshot,
    scopeKey: "acc-1:all",
    reducedMotion: false,
    now: 1100,
    ...overrides,
  });
}

describe("feed move animation", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("moves the surrounding rows from their old positions and leaves the moved row to a fade", () => {
    const tree = setupTree();
    const snapshot = capture(tree.container);
    applyMoveToBravo(tree);

    const result = play(tree.container, snapshot);

    expect(result.outcome).toBe("played");
    expect(tree.a2.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(20px)" }, { transform: "translateY(0)" }],
      expect.objectContaining({ duration: expect.any(Number) }),
    );
    expect(tree.bravo.header.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(20px)" }, { transform: "translateY(0)" }],
      expect.anything(),
    );
    expect(tree.b1.animate).not.toHaveBeenCalled();
    expect(tree.u1.animate).not.toHaveBeenCalled();
    expect(tree.a1.animate).not.toHaveBeenCalled();
    expect(tree.a1.button.animate).toHaveBeenCalledWith([{ opacity: 0.6 }, { opacity: 1 }], expect.any(Object));
  });

  it("does not stack a folder's displacement on its children", () => {
    const tree = setupTree();
    const sectionAnimate = vi.fn();
    tree.alpha.section.animate = sectionAnimate;
    const snapshot = capture(tree.container, { feedId: "a2", destinationFolderId: "bravo" });
    tree.alpha.header.setTop(-20);
    tree.a1.setTop(0);
    tree.a2.setTop(0);
    tree.bravo.panel.prepend(tree.a2.element);

    play(tree.container, snapshot);

    expect(tree.alpha.header.animate).toHaveBeenCalledTimes(1);
    expect(tree.alpha.header.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(20px)" }, { transform: "translateY(0)" }],
      expect.anything(),
    );
    expect(tree.a1.animate).toHaveBeenCalledTimes(1);
    expect(tree.a1.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(20px)" }, { transform: "translateY(0)" }],
      expect.anything(),
    );
    expect(sectionAnimate).not.toHaveBeenCalled();
  });

  it("uses the same path when the feed leaves a folder for the unfoldered list", () => {
    const tree = setupTree();
    const snapshot = capture(tree.container, { destinationFolderId: null });
    tree.u1.element.parentElement?.prepend(tree.a1.element);
    tree.a2.setTop(20);
    tree.bravo.header.setTop(40);
    tree.b1.setTop(60);

    const result = play(tree.container, snapshot);

    expect(result.outcome).toBe("played");
    expect(tree.a2.animate).toHaveBeenCalledTimes(1);
    expect(tree.bravo.header.animate).toHaveBeenCalledTimes(1);
    expect(tree.b1.animate).toHaveBeenCalledTimes(1);
    expect(tree.a1.animate).not.toHaveBeenCalled();
  });

  it("stays pending through layout changes that arrive before the moved row reaches its destination", () => {
    const tree = setupTree();
    const snapshot = capture(tree.container);
    tree.u1.setTop(120);

    expect(play(tree.container, snapshot).outcome).toBe("pending");
    expect(tree.u1.animate).not.toHaveBeenCalled();

    applyMoveToBravo(tree);
    tree.u1.setTop(100);
    expect(play(tree.container, snapshot).outcome).toBe("played");
  });

  it("neither plays nor fades rows inside a closed destination folder", () => {
    const tree = setupTree();
    tree.bravo.panel.setAttribute("aria-hidden", "true");
    tree.bravo.panel.setAttribute("inert", "");
    const snapshot = capture(tree.container);
    tree.bravo.panel.prepend(tree.a1.element);
    tree.a2.setTop(20);
    tree.bravo.header.setTop(40);
    tree.u1.setTop(80);

    const result = play(tree.container, snapshot);

    expect(result.outcome).toBe("played");
    expect(tree.a2.animate).toHaveBeenCalledTimes(1);
    expect(tree.bravo.header.animate).toHaveBeenCalledTimes(1);
    expect(tree.u1.animate).toHaveBeenCalledTimes(1);
    expect(tree.a1.animate).not.toHaveBeenCalled();
    expect(tree.a1.button.animate).not.toHaveBeenCalled();
    expect(tree.b1.animate).not.toHaveBeenCalled();
  });

  it("leaves rows inside a leaving wrapper to the exit motion", () => {
    const tree = setupTree();
    const leaving = document.createElement("div");
    leaving.setAttribute(MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE, "true");
    tree.alpha.panel.appendChild(leaving);
    const ghost = mountMotionFeed(leaving, "ghost", 55);
    const snapshot = capture(tree.container);
    applyMoveToBravo(tree);
    ghost.setTop(35);

    play(tree.container, snapshot);

    expect(ghost.animate).not.toHaveBeenCalled();
    expect(tree.a2.animate).toHaveBeenCalledTimes(1);
  });

  it("discards the snapshot when the list has scrolled since capture", () => {
    const tree = setupTree();
    const snapshot = capture(tree.container);
    applyMoveToBravo(tree);
    tree.container.scrollTop = 40;

    expect(play(tree.container, snapshot).outcome).toBe("discarded");
    expect(tree.a2.animate).not.toHaveBeenCalled();
    expect(tree.a1.button.animate).not.toHaveBeenCalled();
  });

  it("discards the snapshot when the account or view scope has changed", () => {
    const tree = setupTree();
    const snapshot = capture(tree.container);
    applyMoveToBravo(tree);

    expect(play(tree.container, snapshot, { scopeKey: "acc-2:all" }).outcome).toBe("discarded");
    expect(tree.a2.animate).not.toHaveBeenCalled();
  });

  it("discards an expired snapshot", () => {
    const tree = setupTree();
    const snapshot = capture(tree.container);
    applyMoveToBravo(tree);

    const result = play(tree.container, snapshot, { now: 1000 + FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS + 1 });

    expect(result.outcome).toBe("discarded");
    expect(tree.a2.animate).not.toHaveBeenCalled();
  });

  it("uses opacity only when reduced motion is requested", () => {
    const tree = setupTree();
    const snapshot = capture(tree.container);
    applyMoveToBravo(tree);

    play(tree.container, snapshot, { reducedMotion: true });

    expect(tree.a2.animate).toHaveBeenCalledWith([{ opacity: 0.6 }, { opacity: 1 }], expect.any(Object));
    expect(tree.bravo.header.animate).toHaveBeenCalledWith([{ opacity: 0.6 }, { opacity: 1 }], expect.any(Object));
    const keyframes = [tree.a2, tree.bravo.header, tree.a1.button].flatMap((row) =>
      row.animate.mock.calls.flatMap((call) => JSON.stringify(call)),
    );
    expect(keyframes.join()).not.toContain("transform");
  });

  it("takes the timing from the shared motion tokens", () => {
    document.documentElement.style.setProperty("--motion-duration-resize", "300ms");
    document.documentElement.style.setProperty("--motion-duration-contextual", "120ms");
    document.documentElement.style.setProperty("--motion-ease-standard", "ease-in-out");
    const tree = setupTree();
    const snapshot = capture(tree.container);
    applyMoveToBravo(tree);

    play(tree.container, snapshot);

    expect(tree.a2.animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 300, easing: "ease-in-out", fill: "none" }),
    );
    expect(tree.a1.button.animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 120, easing: "ease-in-out" }),
    );
    for (const property of ["--motion-duration-resize", "--motion-duration-contextual", "--motion-ease-standard"]) {
      document.documentElement.style.removeProperty(property);
    }
  });

  describe("watching", () => {
    function startWatch(tree: ReturnType<typeof setupTree>, getScopeKey = () => "acc-1:all") {
      const snapshot = capture(tree.container, { now: Date.now() });
      return watchFeedMoveAnimation({ container: tree.container, snapshot, getScopeKey, reducedMotion: false });
    }

    it("plays once when the move lands and ignores later mutations", () => {
      const tree = setupTree();
      startWatch(tree);

      flushTestMutationObservers();
      expect(tree.a2.animate).not.toHaveBeenCalled();

      applyMoveToBravo(tree);
      flushTestMutationObservers();
      flushTestMutationObservers();

      expect(tree.a2.animate).toHaveBeenCalledTimes(1);
      expect(tree.a1.button.animate).toHaveBeenCalledTimes(1);
    });

    it("cancels the running animations and stops watching when stopped", () => {
      const tree = setupTree();
      const session = startWatch(tree);
      applyMoveToBravo(tree);
      flushTestMutationObservers();

      session.stop();

      expect(tree.a2.cancel).toHaveBeenCalledTimes(1);
      expect(tree.bravo.header.cancel).toHaveBeenCalledTimes(1);
      expect(tree.a1.button.cancel).toHaveBeenCalledTimes(1);
    });

    it("does not play a move that lands after it was stopped", () => {
      const tree = setupTree();
      const session = startWatch(tree);

      session.stop();
      applyMoveToBravo(tree);
      flushTestMutationObservers();

      expect(tree.a2.animate).not.toHaveBeenCalled();
      expect(tree.a1.button.animate).not.toHaveBeenCalled();
    });

    it("does not play a move that lands in another scope", () => {
      const tree = setupTree();
      startWatch(tree, () => "acc-2:all");

      applyMoveToBravo(tree);
      flushTestMutationObservers();

      expect(tree.a2.animate).not.toHaveBeenCalled();
    });

    it("stops watching once the snapshot has expired", () => {
      vi.useFakeTimers();
      const tree = setupTree();
      startWatch(tree);

      vi.advanceTimersByTime(FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS + 1);
      applyMoveToBravo(tree);
      flushTestMutationObservers();

      expect(tree.a2.animate).not.toHaveBeenCalled();
    });
  });
});
