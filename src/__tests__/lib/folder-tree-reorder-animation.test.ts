import { flushTestMutationObservers } from "@tests/setup";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOLDER_REORDER_FOLDER_ID_ATTRIBUTE,
  FOLDER_REORDER_TARGET_ATTRIBUTE,
} from "@/lib/sidebar/folder-tree-drop-target";
import {
  captureFolderReorderSnapshot,
  FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS,
  playFolderReorderAnimation,
  watchFolderReorderAnimation,
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
    const outcome = playFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
      now: 1100,
    });

    expect(outcome).toBe("played");
    expect(alpha.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(-20px)" }, { transform: "translateY(0)" }],
      expect.objectContaining({ duration: expect.any(Number) }),
    );
    expect(bravo.animate).toHaveBeenCalledWith(
      [{ transform: "translateY(20px)" }, { transform: "translateY(0)" }],
      expect.anything(),
    );
  });

  it("takes the row motion timing from the shared motion tokens instead of an inline curve", () => {
    document.documentElement.style.setProperty("--motion-duration-resize", "300ms");
    document.documentElement.style.setProperty("--motion-ease-standard", "cubic-bezier(0.1, 0.2, 0.3, 0.4)");
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
      reducedMotion: false,
      now: 1100,
    });

    expect(alpha.animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 300, easing: "cubic-bezier(0.1, 0.2, 0.3, 0.4)" }),
    );
    document.documentElement.style.removeProperty("--motion-duration-resize");
    document.documentElement.style.removeProperty("--motion-ease-standard");
  });

  it("reports unmoved so the snapshot survives a render that has not applied the new order yet", () => {
    const { container, alpha, bravo } = setup();
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      now: 1000,
    });
    if (!snapshot) {
      throw new Error("snapshot should be captured while target rows exist");
    }

    const outcome = playFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
      now: 1100,
    });

    expect(outcome).toBe("unmoved");
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
    const outcome = playFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
      now: 1000 + FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS + 1,
    });

    expect(outcome).toBe("expired");
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

    expect(alpha.animate).toHaveBeenCalledWith([{ opacity: 0.6 }, { opacity: 1 }], expect.any(Object));
  });

  it("keeps watching through renders that leave rows in place and plays once a row actually moves", () => {
    const { container, alpha, bravo } = setup();
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      now: Date.now(),
    });
    if (!snapshot) {
      throw new Error("snapshot should be captured while target rows exist");
    }
    const stop = watchFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
    });

    flushTestMutationObservers();
    expect(alpha.animate).not.toHaveBeenCalled();

    alpha.setTop(20);
    bravo.setTop(0);
    flushTestMutationObservers();
    expect(alpha.animate).toHaveBeenCalledTimes(1);
    expect(bravo.animate).toHaveBeenCalledTimes(1);

    flushTestMutationObservers();
    expect(alpha.animate).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops watching when cancelled so a later reorder is not animated from the old snapshot", () => {
    const { container, alpha } = setup();
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      now: Date.now(),
    });
    if (!snapshot) {
      throw new Error("snapshot should be captured while target rows exist");
    }
    const stop = watchFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      snapshot,
      reducedMotion: false,
    });
    stop();

    alpha.setTop(20);
    flushTestMutationObservers();

    expect(alpha.animate).not.toHaveBeenCalled();
  });

  describe("with a caller-specified id attribute", () => {
    const ID_ATTRIBUTE = "data-test-row-id";

    function mountRowWithAttributes(container: HTMLElement, attributes: Record<string, string>, top: number): TestRow {
      const row = mountRow(container, "unused", top);
      row.element.removeAttribute(FOLDER_REORDER_FOLDER_ID_ATTRIBUTE);
      for (const [name, value] of Object.entries(attributes)) {
        row.element.setAttribute(name, value);
      }
      return row;
    }

    it("matches rows before and after the move by the value of that attribute", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const alpha = mountRowWithAttributes(container, { [ID_ATTRIBUTE]: "alpha" }, 0);
      const bravo = mountRowWithAttributes(container, { [ID_ATTRIBUTE]: "bravo" }, 20);
      const snapshot = captureFolderReorderSnapshot({
        container,
        targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
        idAttribute: ID_ATTRIBUTE,
        now: 1000,
      });
      if (!snapshot) {
        throw new Error("snapshot should be captured while rows carry the id attribute");
      }

      alpha.setTop(20);
      bravo.setTop(0);
      const outcome = playFolderReorderAnimation({
        container,
        targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
        idAttribute: ID_ATTRIBUTE,
        snapshot,
        reducedMotion: false,
        now: 1100,
      });

      expect(outcome).toBe("played");
      expect(alpha.animate).toHaveBeenCalledWith(
        [{ transform: "translateY(-20px)" }, { transform: "translateY(0)" }],
        expect.anything(),
      );
      expect(bravo.animate).toHaveBeenCalledWith(
        [{ transform: "translateY(20px)" }, { transform: "translateY(0)" }],
        expect.anything(),
      );
    });

    it("ignores rows without that attribute and rows outside the target attribute", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const identified = mountRowWithAttributes(container, { [ID_ATTRIBUTE]: "alpha" }, 0);
      const otherIdAttributeOnly = mountRowWithAttributes(
        container,
        { [FOLDER_REORDER_FOLDER_ID_ATTRIBUTE]: "alpha" },
        20,
      );
      const outsideTarget = mountRowWithAttributes(container, { [ID_ATTRIBUTE]: "alpha" }, 40);
      outsideTarget.element.removeAttribute(FOLDER_REORDER_TARGET_ATTRIBUTE);
      const snapshot = captureFolderReorderSnapshot({
        container,
        targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
        idAttribute: ID_ATTRIBUTE,
        now: 1000,
      });
      if (!snapshot) {
        throw new Error("snapshot should be captured while a row carries the id attribute");
      }

      identified.setTop(60);
      otherIdAttributeOnly.setTop(80);
      outsideTarget.setTop(100);
      playFolderReorderAnimation({
        container,
        targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
        idAttribute: ID_ATTRIBUTE,
        snapshot,
        reducedMotion: false,
        now: 1100,
      });

      expect(identified.animate).toHaveBeenCalledTimes(1);
      expect(otherIdAttributeOnly.animate).not.toHaveBeenCalled();
      expect(outsideTarget.animate).not.toHaveBeenCalled();
    });
  });
});
