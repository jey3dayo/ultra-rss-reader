import type { FolderDto } from "@/api/tauri-commands";

export type FolderOrderMode = "name" | "manual";

export function resolveFolderOrderMode(folderOrderMode: FolderOrderMode | undefined): FolderOrderMode {
  return folderOrderMode === "manual" ? "manual" : "name";
}

export function sortSidebarFolders(
  folders: readonly FolderDto[],
  folderOrderMode: FolderOrderMode | undefined,
): FolderDto[] {
  const sorted = folders.slice();
  if (resolveFolderOrderMode(folderOrderMode) === "manual") {
    sorted.sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }
      return left.id.localeCompare(right.id);
    });
    return sorted;
  }

  sorted.sort((left, right) => left.name.localeCompare(right.name));
  return sorted;
}

export function buildNameOrderedFolderIds(folders: readonly FolderDto[]): string[] {
  return sortSidebarFolders(folders, "name").map((folder) => folder.id);
}

export function applyVisibleReorderToFullOrder(
  fullOrder: readonly string[],
  visibleOrderBefore: readonly string[],
  visibleOrderAfter: readonly string[],
): string[] {
  const visibleAfterQueue = visibleOrderAfter.slice();
  const visibleBeforeSet = new Set(visibleOrderBefore);
  return fullOrder.map((folderId) => {
    if (!visibleBeforeSet.has(folderId)) {
      return folderId;
    }
    const nextVisibleId = visibleAfterQueue.shift();
    return nextVisibleId ?? folderId;
  });
}

function buildFullFolderOrderAfterVisibleReorder(params: {
  folders: readonly FolderDto[];
  folderOrderMode: FolderOrderMode | undefined;
  visibleOrderBefore: readonly string[];
  visibleOrderAfter: readonly string[];
}): string[] {
  const { folders, folderOrderMode, visibleOrderBefore, visibleOrderAfter } = params;
  const fullOrder = sortSidebarFolders(folders, folderOrderMode).map((folder) => folder.id);
  return applyVisibleReorderToFullOrder(fullOrder, visibleOrderBefore, visibleOrderAfter);
}

export function buildFullFolderOrderAfterVisibleMove(params: {
  folders: readonly FolderDto[];
  folderOrderMode: FolderOrderMode | undefined;
  visibleOrderedFolderIds: readonly string[];
  movedFolderId: string;
  targetVisibleIndex: number;
}): string[] {
  const { folders, folderOrderMode, visibleOrderedFolderIds, movedFolderId, targetVisibleIndex } = params;
  const visibleOrderAfter = visibleOrderedFolderIds.slice();
  const currentIndex = visibleOrderAfter.indexOf(movedFolderId);
  if (currentIndex < 0) {
    return sortSidebarFolders(folders, folderOrderMode).map((folder) => folder.id);
  }

  visibleOrderAfter.splice(currentIndex, 1);
  let insertIndex = targetVisibleIndex;
  if (targetVisibleIndex > currentIndex) {
    insertIndex = targetVisibleIndex - 1;
  }
  const clampedTargetIndex = Math.max(0, Math.min(insertIndex, visibleOrderAfter.length));
  visibleOrderAfter.splice(clampedTargetIndex, 0, movedFolderId);

  return buildFullFolderOrderAfterVisibleReorder({
    folders,
    folderOrderMode,
    visibleOrderBefore: visibleOrderedFolderIds,
    visibleOrderAfter,
  });
}
