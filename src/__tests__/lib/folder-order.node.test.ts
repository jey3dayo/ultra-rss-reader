import { describe, expect, it } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import {
  applyVisibleReorderToFullOrder,
  buildFullFolderOrderAfterNeighborMove,
  buildFullFolderOrderAfterVisibleMove,
  buildNameOrderedFolderIds,
  sortSidebarFolders,
  swapVisibleFolderNeighbors,
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

  it("sorts folders by sort_order in manual mode", () => {
    expect(sortSidebarFolders(folders, "manual").map((folder) => folder.id)).toEqual([
      "folder-a",
      "folder-b",
      "folder-c",
    ]);
  });

  it("swaps visible neighbors and maps back to full order", () => {
    const visibleOrderBefore = ["folder-a", "folder-c"];
    const visibleOrderAfter = swapVisibleFolderNeighbors(visibleOrderBefore, "folder-c", "up");
    expect(visibleOrderAfter).toEqual(["folder-c", "folder-a"]);

    const fullOrder = applyVisibleReorderToFullOrder(
      ["folder-b", "folder-a", "folder-c"],
      visibleOrderBefore,
      visibleOrderAfter ?? [],
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

  it("builds full order after neighbor move", () => {
    const nextOrder = buildFullFolderOrderAfterNeighborMove({
      folders,
      folderOrderMode: "name",
      visibleOrderedFolderIds: ["folder-a", "folder-b", "folder-c"],
      folderId: "folder-b",
      direction: "down",
    });
    expect(nextOrder).toEqual(["folder-a", "folder-c", "folder-b"]);
  });

  it("builds name ordered folder ids", () => {
    expect(buildNameOrderedFolderIds(folders)).toEqual(["folder-a", "folder-b", "folder-c"]);
  });
});
