import { describe, expect, it } from "vitest";
import { buildFolderOptions } from "@/components/reader/hooks/feed-dialogs/use-folder-selection";

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
});
