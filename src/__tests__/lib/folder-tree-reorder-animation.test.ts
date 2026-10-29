import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOLDER_REORDER_FOLDER_ID_ATTRIBUTE,
  FOLDER_REORDER_TARGET_ATTRIBUTE,
} from "@/lib/sidebar/folder-tree-drop-target";
import {
  captureFolderReorderSnapshot,
  FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS,
  playFolderReorderAnimation,
} from "@/lib/sidebar/folder-tree-reorder-animation";

type TestRow = { element: HTMLElement; animate: ReturnType<typeof vi.fn>; setTop: (top: number) => void };

function mountRow(container: HTMLElement, folderId: string, top: number): TestRow {
  const element = document.createElement("div");
  element.setAttribute(FOLDER_REORDER_TARGET_ATTRIBUTE, "true");
  element.setAttribute(FOLDER_REORDER_FOLDER_ID_ATTRIBUTE, folderId);
  let currentTop = top;
  element.getBoundingClientRect = () => ({ top: currentTop, bottom: currentTop + 20 }) as DOMRect;
  const animate = vi.fn();
  element.animate = animate;
  container.appendChild(element);
  return {
    element,
    animate,
    setTop: (nextTop) => {
      currentTop = nextTop;
    },
  };
}

describe("folder reorder animation", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function setup() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const alpha = mountRow(container, "alpha", 0);
    const bravo = mountRow(container, "bravo", 20);
    return { container, alpha, bravo };
  }

  it("animates only the rows that moved from the captured position once the order has changed", () => {
    const { container, alpha, bravo } = setup();
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      now: 1000,
    });
    if (!snapshot) {
      throw new Error("snapshot should be captured while target rows exist");
    }

    alpha.setTop(20);
    bravo.setTop(0);
    playFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
      now: 1100,
    });

    expect(alpha.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(-20px)" }, { transform: "translateY(0)" }],
      expect.objectContaining({ duration: expect.any(Number) }),
    );
    expect(bravo.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(20px)" }, { transform: "translateY(0)" }],
      expect.anything(),
    );
  });

  it("skips rows that did not move", () => {
    const { container, alpha, bravo } = setup();
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      now: 1000,
    });
    if (!snapshot) {
      throw new Error("snapshot should be captured while target rows exist");
    }

    playFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
      now: 1100,
    });

    expect(alpha.animate).not.toHaveBeenCalled();
    expect(bravo.animate).not.toHaveBeenCalled();
  });

  it("ignores a stale snapshot so an unrelated later reorder is not animated from old positions", () => {
    const { container, alpha } = setup();
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      now: 1000,
    });
    if (!snapshot) {
      throw new Error("snapshot should be captured while target rows exist");
    }

    alpha.setTop(40);
    playFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
      now: 1000 + FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS + 1,
    });

    expect(alpha.animate).not.toHaveBeenCalled();
  });

  it("flashes a highlight instead of translating when reduced motion is requested", () => {
    const { container, alpha } = setup();
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      now: 1000,
    });
    if (!snapshot) {
      throw new Error("snapshot should be captured while target rows exist");
    }

    alpha.setTop(20);
    playFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: true,
      now: 1100,
    });

    expect(alpha.animate).toHaveBeenCalledWith(
      [{ backgroundColor: "var(--feed-tree-drop-target-surface)" }, { backgroundColor: "transparent" }],
      expect.objectContaining({ fill: "none" }),
    );
  });
});
