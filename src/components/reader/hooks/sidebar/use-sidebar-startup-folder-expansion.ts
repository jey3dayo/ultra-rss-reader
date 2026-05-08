import { useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@/constants/storage";
import { safeParseJsonWithSchema } from "@/schemas/parse";
import { type StoredSidebarExpandedFolders, StoredSidebarExpandedFoldersSchema } from "@/schemas/storage";
import type { SidebarStartupFolderExpansionParams } from "../../sidebar-feed-section.types";

function readStoredSidebarExpandedFolders(): StoredSidebarExpandedFolders {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders);
    if (!raw) {
      return {};
    }

    return safeParseJsonWithSchema(raw, StoredSidebarExpandedFoldersSchema) ?? {};
  } catch {
    return {};
  }
}

function getStoredSidebarExpandedFolders(accountId: string): string[] {
  return readStoredSidebarExpandedFolders()[accountId] ?? [];
}

function setStoredSidebarExpandedFolders(accountId: string, folderIds: Iterable<string>): void {
  const nextState = readStoredSidebarExpandedFolders();
  nextState[accountId] = [...new Set(folderIds)];
  window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, JSON.stringify(nextState));
}

export function useSidebarStartupFolderExpansion({
  selectedAccountId,
  expandedFolderIds,
  feedList,
  folderList,
  startupFolderExpansion,
  feedsReady,
  foldersReady,
  setExpandedFolders,
}: SidebarStartupFolderExpansionParams) {
  const startupExpansionTokenRef = useRef<string | null>(null);
  const skipPersistenceTokenRef = useRef<string | null>(null);
  const startupExpansionToken = selectedAccountId ? `${selectedAccountId}:${startupFolderExpansion}` : null;

  useEffect(() => {
    if (!selectedAccountId) {
      startupExpansionTokenRef.current = null;
      skipPersistenceTokenRef.current = null;
      return;
    }

    if (!feedsReady || !foldersReady) {
      return;
    }

    if (startupExpansionTokenRef.current === startupExpansionToken) {
      return;
    }

    if (expandedFolderIds.size > 0 && startupFolderExpansion !== "restore_previous") {
      startupExpansionTokenRef.current = startupExpansionToken;
      return;
    }

    const validFolderIds = new Set(folderList.map((folder) => folder.id));
    let nextExpandedFolderIds = new Set<string>();

    if (startupFolderExpansion === "unread_folders") {
      nextExpandedFolderIds = new Set(
        feedList
          .filter((feed) => feed.folder_id && feed.unread_count > 0)
          .map((feed) => feed.folder_id)
          .filter((folderId): folderId is string => typeof folderId === "string")
          .filter((folderId) => validFolderIds.has(folderId)),
      );
    } else if (startupFolderExpansion === "restore_previous") {
      nextExpandedFolderIds = new Set(
        getStoredSidebarExpandedFolders(selectedAccountId).filter((folderId) => validFolderIds.has(folderId)),
      );
    }

    setExpandedFolders(nextExpandedFolderIds);
    startupExpansionTokenRef.current = startupExpansionToken;
    skipPersistenceTokenRef.current = startupExpansionToken;
  }, [
    expandedFolderIds,
    feedList,
    feedsReady,
    folderList,
    foldersReady,
    selectedAccountId,
    setExpandedFolders,
    startupFolderExpansion,
    startupExpansionToken,
  ]);

  useEffect(() => {
    if (!selectedAccountId) {
      startupExpansionTokenRef.current = null;
      skipPersistenceTokenRef.current = null;
      return;
    }

    if (startupFolderExpansion === "restore_previous" && startupExpansionTokenRef.current !== startupExpansionToken) {
      return;
    }

    if (skipPersistenceTokenRef.current === startupExpansionToken) {
      skipPersistenceTokenRef.current = null;
      return;
    }

    setStoredSidebarExpandedFolders(selectedAccountId, expandedFolderIds);
  }, [expandedFolderIds, selectedAccountId, startupFolderExpansion, startupExpansionToken]);
}
