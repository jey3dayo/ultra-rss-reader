import { describe, expect, it } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import {
  applyVisibleReorderToFullOrder,
  buildFullFolderOrderAfterVisibleMove,
  buildNameOrderedFolderIds,
  sortSidebarFolders,
} from "@/lib/sidebar/folder-order";

const folders: FolderDto[] = [
  { id: "folder-b", account_id: "acc-1", name: "Bravo", sort_order: 1 },
  { id: "folder-a", account_id: "acc-1", name: "Alpha", sort_order: 0 },
  { id: "folder-c", account_id: "acc-1", name: "Charlie", sort_order: 2 },
];

describe("folder-order", () => {
  it("sorts folders by name by default", () => {
    expect(sortSidebarFolders(folders, "name").map((folder) => folder.id)).toEqual([
      "folder-a",
      "folder-b",
      "folder-c",
    ]);
  });

  it("sorts folders by sort_order in manual mode, not by name", () => {
    const manuallyOrdered: FolderDto[] = [
      { id: "folder-a", account_id: "acc-1", name: "Alpha", sort_order: 2 },
      { id: "folder-b", account_id: "acc-1", name: "Bravo", sort_order: 0 },
      { id: "folder-c", account_id: "acc-1", name: "Charlie", sort_order: 1 },
    ];

    expect(sortSidebarFolders(manuallyOrdered, "manual").map((folder) => folder.id)).toEqual([
      "folder-b",
      "folder-c",
      "folder-a",
    ]);
  });

  it("maps a visible reorder back to the full order", () => {
    const fullOrder = applyVisibleReorderToFullOrder(
      ["folder-b", "folder-a", "folder-c"],
      ["folder-a", "folder-c"],
      ["folder-c", "folder-a"],
    );
    expect(fullOrder).toEqual(["folder-b", "folder-c", "folder-a"]);
  });

  it("builds full order after visible move", () => {
    const nextOrder = buildFullFolderOrderAfterVisibleMove({
      folders,
      folderOrderMode: "name",
      visibleOrderedFolderIds: ["folder-a", "folder-b", "folder-c"],
      movedFolderId: "folder-c",
      targetVisibleIndex: 0,
    });
    expect(nextOrder).toEqual(["folder-c", "folder-a", "folder-b"]);
  });

  it("adjusts downward insertion index after removing the dragged folder", () => {
    const nextOrder = buildFullFolderOrderAfterVisibleMove({
      folders,
      folderOrderMode: "name",
      visibleOrderedFolderIds: ["folder-a", "folder-b", "folder-c"],
      movedFolderId: "folder-a",
      targetVisibleIndex: 2,
    });
    expect(nextOrder).toEqual(["folder-b", "folder-a", "folder-c"]);
  });

  it("builds name ordered folder ids", () => {
    expect(buildNameOrderedFolderIds(folders)).toEqual(["folder-a", "folder-b", "folder-c"]);
  });
});
