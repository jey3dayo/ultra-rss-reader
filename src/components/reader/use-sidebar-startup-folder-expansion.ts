import { useEffect, useRef } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { STORAGE_KEYS } from "@/constants/storage";

export type StartupFolderExpansionMode = "all_collapsed" | "restore_previous" | "unread_folders";

type UseSidebarStartupFolderExpansionParams = {
  selectedAccountId: string | null;
  expandedFolderIds: Set<string>;
  feedList: FeedDto[];
  folderList: FolderDto[];
  startupFolderExpansion: StartupFolderExpansionMode;
  feedsReady: boolean;
  foldersReady: boolean;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
};

type StoredSidebarExpandedFolders = Record<string, string[]>;

function readStoredSidebarExpandedFolders(): StoredSidebarExpandedFolders {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const entries = Object.entries(parsed).flatMap(([accountId, folderIds]) =>
      Array.isArray(folderIds) && folderIds.every((folderId) => typeof folderId === "string")
        ? [[accountId, folderIds] as const]
        : [],
    );
    return Object.fromEntries(entries);
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
}: UseSidebarStartupFolderExpansionParams) {
  const startupExpansionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedAccountId) {
      startupExpansionTokenRef.current = null;
      return;
    }

    setStoredSidebarExpandedFolders(selectedAccountId, expandedFolderIds);
  }, [expandedFolderIds, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) {
      startupExpansionTokenRef.current = null;
      return;
    }

    if (!feedsReady || !foldersReady) {
      return;
    }

    const token = `${selectedAccountId}:${startupFolderExpansion}`;
    if (startupExpansionTokenRef.current === token) {
      return;
    }

    if (expandedFolderIds.size > 0 && startupFolderExpansion !== "restore_previous") {
      startupExpansionTokenRef.current = token;
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
    startupExpansionTokenRef.current = token;
  }, [
    expandedFolderIds,
    feedList,
    feedsReady,
    folderList,
    foldersReady,
    selectedAccountId,
    setExpandedFolders,
    startupFolderExpansion,
  ]);
}
