import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NEW_FOLDER_VALUE } from "@/components/reader/folder-select-view";
import { useFolderSelection } from "@/components/reader/hooks/feed-dialogs/use-folder-selection";

describe("useFolderSelection focus cleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("cancels pending new-folder focus when the dialog resets before the frame runs", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const input = document.createElement("input");
    const focusSpy = vi.spyOn(input, "focus");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 24;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { result } = renderHook(() => useFolderSelection(null));

    act(() => {
      result.current.handleFolderChange(NEW_FOLDER_VALUE);
    });
    result.current.newFolderInputRef.current = input;
    act(() => {
      result.current.resetFolderSelection("folder-reset");
    });

    const frameCallback = scheduledCallbacks[0];
    if (!frameCallback) {
      throw new Error("Expected scheduled focus callback");
    }
    frameCallback(0);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(24);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("uses only the newest new-folder focus frame after folder options change", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const input = document.createElement("input");
    const focusSpy = vi.spyOn(input, "focus");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return scheduledCallbacks.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const { result } = renderHook(() => useFolderSelection(null));

    act(() => {
      result.current.handleFolderChange(NEW_FOLDER_VALUE);
    });
    result.current.newFolderInputRef.current = input;
    act(() => {
      result.current.handleFolderChange("folder-existing");
    });

    scheduledCallbacks[0]?.(0);
    expect(focusSpy).not.toHaveBeenCalled();

    act(() => {
      result.current.handleFolderChange(NEW_FOLDER_VALUE);
    });

    scheduledCallbacks[1]?.(0);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1);
  });
});
