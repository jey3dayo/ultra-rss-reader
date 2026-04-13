import { describe, expect, it, vi } from "vitest";
import { applyFeedTreeHoverTarget } from "@/components/reader/feed-tree-hover-target";

describe("applyFeedTreeHoverTarget", () => {
  it("updates hover state and dispatches folder callbacks", () => {
    const setPointerHoverTarget = vi.fn();
    const onDragEnterFolder = vi.fn();
    const onDragEnterUnfoldered = vi.fn();

    applyFeedTreeHoverTarget({
      target: { kind: "folder", folderId: "folder-1" },
      setPointerHoverTarget,
      onDragEnterFolder,
      onDragEnterUnfoldered,
    });

    expect(setPointerHoverTarget).toHaveBeenCalledWith({ kind: "folder", folderId: "folder-1" });
    expect(onDragEnterFolder).toHaveBeenCalledWith("folder-1");
    expect(onDragEnterUnfoldered).not.toHaveBeenCalled();
  });

  it("updates hover state and dispatches unfoldered callbacks", () => {
    const setPointerHoverTarget = vi.fn();
    const onDragEnterFolder = vi.fn();
    const onDragEnterUnfoldered = vi.fn();

    applyFeedTreeHoverTarget({
      target: { kind: "unfoldered" },
      setPointerHoverTarget,
      onDragEnterFolder,
      onDragEnterUnfoldered,
    });

    expect(setPointerHoverTarget).toHaveBeenCalledWith({ kind: "unfoldered" });
    expect(onDragEnterFolder).not.toHaveBeenCalled();
    expect(onDragEnterUnfoldered).toHaveBeenCalledTimes(1);
  });

  it("still clears hover state when there is no drop target", () => {
    const setPointerHoverTarget = vi.fn();

    applyFeedTreeHoverTarget({
      target: null,
      setPointerHoverTarget,
    });

    expect(setPointerHoverTarget).toHaveBeenCalledWith(null);
  });
});
