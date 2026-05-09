import { useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@/constants/storage";
import { parseJsonWithSchemaOrNull } from "@/schemas/parse";
import { type StoredSidebarExpandedFolders, StoredSidebarExpandedFoldersSchema } from "@/schemas/storage";
import type { SidebarStartupFolderExpansionParams } from "../../sidebar-feed-section.types";

type StartupFolderExpansionFeed = SidebarStartupFolderExpansionParams["feedList"][number];
type StartupFolderExpansionFolder = SidebarStartupFolderExpansionParams["folderList"][number];

type ResolveSidebarStartupExpandedFolderIdsParams = {
  startupFolderExpansion: SidebarStartupFolderExpansionParams["startupFolderExpansion"];
  feedList: StartupFolderExpansionFeed[];
  folderList: StartupFolderExpansionFolder[];
  storedFolderIds?: Iterable<string>;
};

function readStoredSidebarExpandedFolders(): StoredSidebarExpandedFolders {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders);
    if (!raw) {
      return {};
    }

    return parseJsonWithSchemaOrNull(raw, StoredSidebarExpandedFoldersSchema) ?? {};
  } catch {
    return {};
  }
}

function getStoredSidebarExpandedFolders(accountId: string): string[] {
  return readStoredSidebarExpandedFolders()[accountId] ?? [];
}

function setStoredSidebarExpandedFolders(accountId: string, folderIds: Iterable<string>): void {
  try {
    const nextState = readStoredSidebarExpandedFolders();
    nextState[accountId] = [...new Set(folderIds)];
    window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, JSON.stringify(nextState));
  } catch {
    // Ignore quota or storage availability failures; expansion state remains in React state.
  }
}

function collectValidFolderIds(folderList: StartupFolderExpansionFolder[]): Set<string> {
  const folderIds = new Set<string>();

  for (const folder of folderList) {
    folderIds.add(folder.id);
  }

  return folderIds;
}

function collectUnreadFolderIds(
  feedList: StartupFolderExpansionFeed[],
  validFolderIds: ReadonlySet<string>,
): Set<string> {
  const unreadFolderIds = new Set<string>();

  for (const feed of feedList) {
    if (feed.folder_id !== null && feed.unread_count > 0 && validFolderIds.has(feed.folder_id)) {
      unreadFolderIds.add(feed.folder_id);
    }
  }

  return unreadFolderIds;
}

export function resolveSidebarStartupExpandedFolderIds({
  startupFolderExpansion,
  feedList,
  folderList,
  storedFolderIds = [],
}: ResolveSidebarStartupExpandedFolderIdsParams): Set<string> {
  if (startupFolderExpansion === "unread_folders") {
    return collectUnreadFolderIds(feedList, collectValidFolderIds(folderList));
  }

  if (startupFolderExpansion === "restore_previous") {
    const validFolderIds = collectValidFolderIds(folderList);
    return new Set([...storedFolderIds].filter((folderId) => validFolderIds.has(folderId)));
  }

  return new Set();
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

    const nextExpandedFolderIds = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion,
      feedList,
      folderList,
      storedFolderIds: getStoredSidebarExpandedFolders(selectedAccountId),
    });

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
