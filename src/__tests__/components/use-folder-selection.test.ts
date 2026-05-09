import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NEW_FOLDER_VALUE } from "@/components/reader/folder-select-view";
import { buildFolderOptions, useFolderSelection } from "@/components/reader/hooks/feed-dialogs/use-folder-selection";

describe("use-folder-selection", () => {
  it("builds a no-folder option when folders are not loaded", () => {
    expect(buildFolderOptions(undefined, "No folder")).toEqual([{ value: "", label: "No folder" }]);
  });

  it("preserves folder order after the no-folder option", () => {
    expect(
      buildFolderOptions(
        [
          { id: "folder-b", name: "Folder B" },
          { id: "folder-a", name: "Folder A" },
        ],
        "No folder",
      ),
    ).toEqual([
      { value: "", label: "No folder" },
      { value: "folder-b", label: "Folder B" },
      { value: "folder-a", label: "Folder A" },
    ]);
  });

  it("omits blank folder ids, falls back for blank names, and keeps the first duplicate id", () => {
    expect(
      buildFolderOptions(
        [
          { id: "", name: "Blank id" },
          { id: "   ", name: "Whitespace id" },
          { id: "folder-a", name: "   " },
          { id: "folder-b", name: "Folder B" },
          { id: "folder-a", name: "Duplicate Folder A" },
        ],
        "No folder",
      ),
    ).toEqual([
      { value: "", label: "No folder" },
      { value: "folder-a", label: "folder-a" },
      { value: "folder-b", label: "Folder B" },
    ]);
  });

  it("disambiguates duplicate folder names without changing unique or blank-name labels", () => {
    expect(
      buildFolderOptions(
        [
          { id: "folder-a", name: "Work" },
          { id: "folder-b", name: "Work" },
          { id: "folder-c", name: "Later" },
          { id: "folder-d", name: "   " },
        ],
        "No folder",
      ),
    ).toEqual([
      { value: "", label: "No folder" },
      { value: "folder-a", label: "Work (folder-a)" },
      { value: "folder-b", label: "Work (folder-b)" },
      { value: "folder-c", label: "Later" },
      { value: "folder-d", label: "folder-d" },
    ]);
  });

  it("clears the new folder draft when selecting an existing folder", () => {
    const { result } = renderHook(() => useFolderSelection(null));

    act(() => {
      result.current.handleFolderChange(NEW_FOLDER_VALUE);
      result.current.setNewFolderName("Draft folder");
    });

    expect(result.current.isCreatingFolder).toBe(true);
    expect(result.current.newFolderName).toBe("Draft folder");

    act(() => {
      result.current.handleFolderChange("folder-1");
    });

    expect(result.current.selectedFolderId).toBe("folder-1");
    expect(result.current.folderSelectValue).toBe("folder-1");
    expect(result.current.isCreatingFolder).toBe(false);
    expect(result.current.newFolderName).toBe("");
  });

  it("resets the selected folder and clears the new folder draft", () => {
    const { result } = renderHook(() => useFolderSelection("folder-initial"));

    act(() => {
      result.current.handleFolderChange(NEW_FOLDER_VALUE);
      result.current.setNewFolderName("Draft folder");
      result.current.resetFolderSelection("folder-reset");
    });

    expect(result.current.selectedFolderId).toBe("folder-reset");
    expect(result.current.folderSelectValue).toBe("folder-reset");
    expect(result.current.isCreatingFolder).toBe(false);
    expect(result.current.newFolderName).toBe("");
  });

  it("cancels pending new folder input focus after unmount", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 12;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const input = document.createElement("input");
    const focusSpy = vi.spyOn(input, "focus");
    const { result, unmount } = renderHook(() => useFolderSelection(null));

    act(() => {
      result.current.handleFolderChange(NEW_FOLDER_VALUE);
    });
    result.current.newFolderInputRef.current = input;

    unmount();
    const frameCallback = scheduledCallbacks[0];
    if (!frameCallback) {
      throw new Error("Expected scheduled focus callback");
    }
    frameCallback(0);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(12);
    expect(focusSpy).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("cancels pending new folder input focus after reset", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 24;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const input = document.createElement("input");
    const focusSpy = vi.spyOn(input, "focus");
    const { result } = renderHook(() => useFolderSelection(null));

    act(() => {
      result.current.handleFolderChange(NEW_FOLDER_VALUE);
    });
    result.current.newFolderInputRef.current = input;
    act(() => {
      result.current.resetFolderSelection("folder-reset");
    });

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(24);
    if (scheduledCallbacks[0] === undefined) {
      throw new Error("Expected scheduled focus callback");
    }
    scheduledCallbacks[0](0);
    expect(focusSpy).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });
});
