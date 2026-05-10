import { useEffect, useRef } from "react";
import { z } from "zod";
import {
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH,
  SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
  STORAGE_KEYS,
} from "@/constants/storage";
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

type SidebarExpandedFoldersStorage = {
  version: typeof SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION;
  accounts: StoredSidebarExpandedFolders;
};

const StoredSidebarExpandedFoldersStorageSchema = z
  .object({
    version: z.literal(SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION),
    accounts: StoredSidebarExpandedFoldersSchema,
  })
  .strict();

function removeSidebarExpandedFoldersStorage(): void {
  window.localStorage.removeItem(STORAGE_KEYS.sidebarExpandedFolders);
}

function writeSidebarExpandedFoldersStorage(storage: SidebarExpandedFoldersStorage): void {
  window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, JSON.stringify(storage));
}

function normalizeSidebarExpandedFoldersStorage(raw: string): SidebarExpandedFoldersStorage | null {
  if (raw.length > MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH) {
    removeSidebarExpandedFoldersStorage();
    return null;
  }

  const parsed = parseStoredSidebarExpandedFolders(raw);
  if (!parsed) {
    removeSidebarExpandedFoldersStorage();
    return null;
  }

  writeNormalizedSidebarExpandedFoldersStorage(raw, parsed);
  return parsed;
}

function normalizeStoredSidebarExpandedFolders(accounts: StoredSidebarExpandedFolders): SidebarExpandedFoldersStorage {
  return {
    version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
    accounts,
  };
}

function parseStoredSidebarExpandedFolders(raw: string): SidebarExpandedFoldersStorage | null {
  const versioned = parseJsonWithSchemaOrNull(raw, StoredSidebarExpandedFoldersStorageSchema);
  if (versioned) {
    return versioned;
  }

  const parsed = parseJsonWithSchemaOrNull(raw, StoredSidebarExpandedFoldersSchema);
  if (parsed) {
    return normalizeStoredSidebarExpandedFolders(parsed);
  }

  return null;
}

function writeNormalizedSidebarExpandedFoldersStorage(
  raw: string | null,
  storage: SidebarExpandedFoldersStorage,
): void {
  const normalized = JSON.stringify(storage);
  if (raw !== normalized) {
    window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, normalized);
  }
}

function readStoredSidebarExpandedFolders(): SidebarExpandedFoldersStorage {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders);
    if (!raw) {
      return normalizeStoredSidebarExpandedFolders({});
    }

    return normalizeSidebarExpandedFoldersStorage(raw) ?? normalizeStoredSidebarExpandedFolders({});
  } catch {
    return normalizeStoredSidebarExpandedFolders({});
  }
}

function buildSidebarFolderIdentity(folderList: StartupFolderExpansionFolder[]): Map<string, Set<string>> {
  const accountFolderIds = new Map<string, Set<string>>();

  for (const folder of folderList) {
    const folderIds = accountFolderIds.get(folder.account_id) ?? new Set<string>();
    folderIds.add(folder.id);
    accountFolderIds.set(folder.account_id, folderIds);
  }

  return accountFolderIds;
}

function pruneSidebarExpandedFoldersForKnownAccounts(
  accounts: StoredSidebarExpandedFolders,
  accountFolderIds: ReadonlyMap<string, ReadonlySet<string>>,
  excludedAccountId: string,
): void {
  for (const [storedAccountId, folderIds] of Object.entries(accounts)) {
    if (storedAccountId === excludedAccountId) {
      continue;
    }

    const storedAccountFolderIds = accountFolderIds.get(storedAccountId);
    if (!storedAccountFolderIds) {
      delete accounts[storedAccountId];
      continue;
    }

    const storedAccountPrunedFolderIds = folderIds.filter((folderId) => storedAccountFolderIds.has(folderId));
    if (storedAccountPrunedFolderIds.length === 0) {
      delete accounts[storedAccountId];
    } else {
      accounts[storedAccountId] = storedAccountPrunedFolderIds.slice(
        0,
        MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
      );
    }
  }
}

function pruneStoredSidebarExpandedFolders(
  storage: SidebarExpandedFoldersStorage,
  accountId: string,
  folderList: StartupFolderExpansionFolder[],
): SidebarExpandedFoldersStorage {
  const accountFolderIds = buildSidebarFolderIdentity(folderList);
  const validFolderIds = accountFolderIds.get(accountId);
  const accounts: StoredSidebarExpandedFolders = { ...storage.accounts };
  const hasOnlySelectedAccountFolders = folderList.every((folder) => folder.account_id === accountId);

  if (!validFolderIds) {
    delete accounts[accountId];
    if (!hasOnlySelectedAccountFolders) {
      pruneSidebarExpandedFoldersForKnownAccounts(accounts, accountFolderIds, accountId);
    }

    return normalizeStoredSidebarExpandedFolders(StoredSidebarExpandedFoldersSchema.parse(accounts));
  }

  const prunedFolderIds = (accounts[accountId] ?? []).filter((folderId) => validFolderIds.has(folderId));
  if (prunedFolderIds.length === 0) {
    delete accounts[accountId];
  } else {
    accounts[accountId] = prunedFolderIds.slice(0, MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT);
  }

  if (!hasOnlySelectedAccountFolders) {
    pruneSidebarExpandedFoldersForKnownAccounts(accounts, accountFolderIds, accountId);
  }

  return normalizeStoredSidebarExpandedFolders(StoredSidebarExpandedFoldersSchema.parse(accounts));
}

function getStoredSidebarExpandedFolders(
  accountId: string,
  folderList: StartupFolderExpansionFolder[],
): SidebarExpandedFoldersStorage {
  const storage = pruneStoredSidebarExpandedFolders(readStoredSidebarExpandedFolders(), accountId, folderList);
  try {
    writeNormalizedSidebarExpandedFoldersStorage(
      window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders),
      storage,
    );
  } catch {
    // Ignore storage cleanup failures; restore still uses the in-memory parsed state.
  }

  return storage;
}

function setStoredSidebarExpandedFolders(
  accountId: string,
  folderIds: Iterable<string>,
  folderList: StartupFolderExpansionFolder[],
): void {
  try {
    const currentState = pruneStoredSidebarExpandedFolders(readStoredSidebarExpandedFolders(), accountId, folderList);
    const accountFolderIds = buildSidebarFolderIdentity(folderList);
    const validFolderIds = accountFolderIds.get(accountId);
    const nextFolderIds = validFolderIds
      ? [...new Set(folderIds)].filter((folderId) => validFolderIds.has(folderId))
      : [];
    const accounts = {
      [accountId]: nextFolderIds.slice(0, MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT),
      ...Object.fromEntries(
        Object.entries(currentState.accounts).filter(([storedAccountId]) => storedAccountId !== accountId),
      ),
    };
    const nextState = normalizeStoredSidebarExpandedFolders(StoredSidebarExpandedFoldersSchema.parse(accounts));
    writeSidebarExpandedFoldersStorage(nextState);
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

function collectValidFolderIdsForAccount(accountId: string, folderList: StartupFolderExpansionFolder[]): Set<string> {
  return buildSidebarFolderIdentity(folderList).get(accountId) ?? new Set<string>();
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
  const skipActivePruneTokenRef = useRef<string | null>(null);
  const skipPersistenceTokenRef = useRef<string | null>(null);
  const startupExpansionToken = selectedAccountId ? `${selectedAccountId}:${startupFolderExpansion}` : null;

  useEffect(() => {
    if (!selectedAccountId) {
      startupExpansionTokenRef.current = null;
      skipActivePruneTokenRef.current = null;
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
      storedFolderIds: getStoredSidebarExpandedFolders(selectedAccountId, folderList).accounts[selectedAccountId] ?? [],
    });

    setExpandedFolders(nextExpandedFolderIds);
    startupExpansionTokenRef.current = startupExpansionToken;
    skipActivePruneTokenRef.current = startupExpansionToken;
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
    if (!selectedAccountId || !foldersReady) {
      return;
    }

    if (startupFolderExpansion === "restore_previous" && startupExpansionTokenRef.current !== startupExpansionToken) {
      return;
    }

    if (skipActivePruneTokenRef.current === startupExpansionToken) {
      skipActivePruneTokenRef.current = null;
      return;
    }

    const validFolderIds = collectValidFolderIdsForAccount(selectedAccountId, folderList);
    const prunedExpandedFolderIds = [...expandedFolderIds].filter((folderId) => validFolderIds.has(folderId));
    if (prunedExpandedFolderIds.length !== expandedFolderIds.size) {
      setExpandedFolders(prunedExpandedFolderIds);
    }
  }, [
    expandedFolderIds,
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
      skipActivePruneTokenRef.current = null;
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

    setStoredSidebarExpandedFolders(selectedAccountId, expandedFolderIds, folderList);
  }, [expandedFolderIds, folderList, selectedAccountId, startupFolderExpansion, startupExpansionToken]);
}
