import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it, vi } from "vitest";
import { useSidebarFolderDragState } from "@/components/reader/hooks/sidebar/use-sidebar-folder-drag-state";

setupBrowserTestDom();

function renderDragState(visibleOrderedFolderIds: readonly string[]) {
  const onReorderToVisibleIndex = vi.fn();
  const view = renderHook(() =>
    useSidebarFolderDragState({
      canDragFolders: true,
      isFeedsSectionOpen: true,
      visibleOrderedFolderIdsRef: { current: visibleOrderedFolderIds },
      onReorderToVisibleIndex,
    }),
  );
  return { ...view, onReorderToVisibleIndex };
}

describe("useSidebarFolderDragState drop index", () => {
  it("passes the dropped gap index through; the order helper adjusts it for the removed folder", () => {
    const { result, onReorderToVisibleIndex } = renderDragState(["a", "b", "c"]);

    act(() => result.current.handleDropFolderReorder("a", 2));

    expect(onReorderToVisibleIndex).toHaveBeenCalledWith("a", 2);
  });

  it("keeps the index for an earlier gap and ignores a drop in the gaps adjacent to the folder", () => {
    const { result, onReorderToVisibleIndex } = renderDragState(["a", "b", "c"]);

    act(() => result.current.handleDropFolderReorder("c", 0));
    expect(onReorderToVisibleIndex).toHaveBeenCalledWith("c", 0);

    onReorderToVisibleIndex.mockClear();
    act(() => result.current.handleDropFolderReorder("a", 1));
    act(() => result.current.handleDropFolderReorder("a", 0));
    expect(onReorderToVisibleIndex).not.toHaveBeenCalled();
  });
});
