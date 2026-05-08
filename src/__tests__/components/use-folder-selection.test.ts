import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
