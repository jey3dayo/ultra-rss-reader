import { parse } from "valibot";
import { create } from "zustand";
import { getPreferredAccountId } from "@/lib/account/account-selection";
import {
  addRetainedArticle,
  addRetainedArticles,
  getRetainedArticleIdsAfterSelectingArticle,
} from "@/lib/articles/article-retention";
import type { FocusedPane } from "@/lib/layout/layout-state.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import { SubscriptionsWorkspaceReturnStateSchema } from "@/schemas/subscriptions-workspace";
import type {
  NativeLifecycleBlockerEntry,
  NativeLifecycleBlockerOwner,
  NativeLifecycleBlockerSnapshot,
  UiActions,
  UiState,
  UiStoreReaderSelection,
  UiStoreState,
} from "@/stores/ui-store.types";
import { createUiStoreDialogActions, type UiStoreDialogToastRuntime } from "@/stores/ui-store-dialog-actions";
import { createUiStoreSettingsActions, getSettingsAccountsViewState } from "@/stores/ui-store-settings-actions";
import { createUiStoreSyncActions, getIdleSyncProgress } from "@/stores/ui-store-sync-actions";
import { TOAST_AUTO_DISMISS_TIMEOUT_MS } from "../constants/ui-runtime";

export type {
  ArticleEngagement,
  NativeLifecycleBlockerEntry,
  NativeLifecycleBlockerOwner,
  NativeLifecycleBlockerSnapshot,
  SyncProgressEventDto,
  SyncProgressUiState,
  UiStoreAccountSetupActions,
  UiStoreAccountSetupState,
  UiStoreDialogActions,
  UiStoreDialogState,
  UiStoreLayoutActions,
  UiStoreLayoutState,
  UiStoreReaderActions,
  UiStoreReaderSelection,
  UiStoreReaderSelectionActions,
  UiStoreReaderSelectionState,
  UiStoreReaderState,
  UiStoreSettingsActions,
  UiStoreSettingsModalActions,
  UiStoreSettingsModalState,
  UiStoreSettingsState,
  UiStoreShellState,
  UiStoreState,
  UiStoreSyncProgressActions,
  UiStoreSyncProgressState,
  UiStoreToastActions,
  UiStoreToastState,
} from "@/stores/ui-store.types";

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastAnnouncementId = 0;

function getSidebarHiddenFallbackPane(state: Pick<UiState, "contentMode">): FocusedPane {
  return state.contentMode === "empty" ? "list" : "content";
}

function getContextAwareScopeViewMode(state: Pick<UiState, "selection" | "viewMode">): "unread" | "starred" {
  return state.viewMode === "starred" || (state.selection.type === "smart" && state.selection.kind === "starred")
    ? "starred"
    : "unread";
}

function getSmartViewMode(kind: Extract<UiStoreReaderSelection, { type: "smart" }>["kind"]): UiState["viewMode"] {
  if (kind === "starred") {
    return "starred";
  }

  return kind === "recent" ? "all" : "unread";
}

function getResetBrowserState() {
  return {
    browserUrl: null,
    browserNavigationState: null,
    browserCloseInFlight: false,
    pendingBrowserCloseAction: null,
    pendingBrowserCloseActionQueue: [],
  };
}

type ClosedBrowserReaderState = Pick<
  UiState,
  | "accountPaneOpen"
  | "contentMode"
  | "sidebarOpen"
  | "focusedPane"
  | "browserUrl"
  | "browserNavigationState"
  | "browserCloseInFlight"
  | "pendingBrowserCloseAction"
  | "pendingBrowserCloseActionQueue"
>;

function getClosedBrowserReaderState(state: Pick<UiState, "selectedArticleId">): ClosedBrowserReaderState {
  return {
    accountPaneOpen: false,
    contentMode: state.selectedArticleId ? ("reader" as const) : ("empty" as const),
    sidebarOpen: true,
    focusedPane: "list" as const,
    ...getResetBrowserState(),
  };
}

function getResetArticleReaderScrollState() {
  return {
    articleReaderScrollPositions: new Map<string, number>(),
  };
}

type ReaderScopeResetState = Pick<
  UiState,
  | "accountPaneOpen"
  | "selection"
  | "selectedArticleId"
  | "contentMode"
  | "focusedPane"
  | "browserUrl"
  | "browserNavigationState"
  | "browserCloseInFlight"
  | "pendingBrowserCloseAction"
  | "pendingBrowserCloseActionQueue"
  | "recentlyReadIds"
  | "retainedArticleIds"
  | "articleReaderScrollPositions"
> &
  Partial<Pick<UiState, "viewMode" | "expandedFolderIds">>;

function getReaderScopeResetState(
  selection: UiStoreReaderSelection,
  options: {
    viewMode?: ViewMode;
    expandedFolderIds?: Set<string>;
  } = {},
): ReaderScopeResetState {
  const nextState: ReaderScopeResetState = {
    accountPaneOpen: false,
    selection,
    selectedArticleId: null,
    contentMode: "empty",
    focusedPane: "list",
    ...getResetBrowserState(),
    ...getResetArticleReaderScrollState(),
    recentlyReadIds: new Set(),
    retainedArticleIds: new Set(),
  };

  if (options.viewMode !== undefined) {
    nextState.viewMode = options.viewMode;
  }
  if (options.expandedFolderIds !== undefined) {
    nextState.expandedFolderIds = options.expandedFolderIds;
  }

  return nextState;
}

type AccountSelectionResetState = Pick<
  UiState,
  | "selectedAccountId"
  | "accountPaneOpen"
  | "commandPaletteOpen"
  | "selection"
  | "viewMode"
  | "selectedArticleId"
  | "contentMode"
  | "focusedPane"
  | "expandedFolderIds"
  | "browserUrl"
  | "webPreviewSessionMode"
  | "browserNavigationState"
  | "browserCloseInFlight"
  | "pendingBrowserCloseAction"
  | "pendingBrowserCloseActionQueue"
  | "recentlyReadIds"
  | "retainedArticleIds"
  | "articleReaderScrollPositions"
>;

function getAccountSelectionResetState({
  selectedAccountId,
  selection,
  focusedPane,
  viewMode = "unread",
}: {
  selectedAccountId: string | null;
  selection: UiStoreReaderSelection;
  focusedPane: FocusedPane;
  viewMode?: ViewMode;
}): AccountSelectionResetState {
  return {
    selectedAccountId,
    accountPaneOpen: false,
    commandPaletteOpen: false,
    selection,
    viewMode,
    selectedArticleId: null,
    contentMode: "empty",
    focusedPane,
    expandedFolderIds: new Set(),
    webPreviewSessionMode: "auto",
    ...getResetBrowserState(),
    ...getResetArticleReaderScrollState(),
    recentlyReadIds: new Set(),
    retainedArticleIds: new Set(),
  };
}

function clearToastDismissTimer(): void {
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function nextToastAnnouncementId(): number {
  toastAnnouncementId += 1;
  return toastAnnouncementId;
}

const scheduleToastDismiss: UiStoreDialogToastRuntime["scheduleToastDismiss"] = (data, set) => {
  if (data.persistent) {
    return;
  }

  const dismissTimer = setTimeout(() => {
    set((state) => (state.toastMessage === data ? { toastMessage: null } : state));
    if (toastTimer === dismissTimer) {
      toastTimer = null;
    }
  }, TOAST_AUTO_DISMISS_TIMEOUT_MS);
  toastTimer = dismissTimer;
};

function createNativeLifecycleBlockerSnapshot(
  entries: ReadonlyMap<NativeLifecycleBlockerOwner, NativeLifecycleBlockerEntry>,
): NativeLifecycleBlockerSnapshot {
  const activeEntries = [...entries.values()].filter((entry) => entry.dirty || entry.pending);
  return {
    dirty: activeEntries.some((entry) => entry.dirty),
    pending: activeEntries.some((entry) => entry.pending),
    owners: activeEntries.map((entry) => entry.owner),
  };
}

const initialState: UiState = {
  layoutMode: "wide",
  focusedPane: "sidebar",
  sidebarOpen: true,
  accountPaneOpen: false,
  contentMode: "empty",
  selectedAccountId: null,
  selection: { type: "all" },
  selectedArticleId: null,
  articleEngagement: "reading",
  viewMode: "unread",
  searchQuery: "",
  browserUrl: null,
  webPreviewSessionMode: "auto",
  browserNavigationState: null,
  browserCloseInFlight: false,
  pendingBrowserCloseAction: null,
  pendingBrowserCloseActionQueue: [],
  articleNavigationDirection: null,
  hasNextArticle: false,
  expandedFolderIds: new Set(),
  isFeedsSectionOpen: true,
  isTagsSectionOpen: true,
  settingsOpen: false,
  settingsCategory: "general",
  settingsAccountId: null,
  settingsAddAccount: false,
  settingsAddAccountInitialKind: null,
  settingsLoading: false,
  subscriptionsWorkspace: null,
  syncProgress: getIdleSyncProgress(),
  accountSetupSession: null,
  commandPaletteOpen: false,
  shortcutsHelpOpen: false,
  isAddFeedDialogOpen: false,
  toastMessage: null,
  toastAnnouncements: [],
  recentlyReadIds: new Set(),
  retainedArticleIds: new Set(),
  articleReaderScrollPositions: new Map(),
  confirmDialog: {
    open: false,
    message: "",
    actionLabel: null,
    actionAccessibleLabel: null,
    variant: "default",
    icon: null,
    onConfirm: null,
  },
  nativeLifecycleBlockers: new Map(),
};

export const useUiStore = create<UiState & UiActions>()((set, get) => ({
  ...initialState,
  ...createUiStoreDialogActions(set, {
    clearToastDismissTimer,
    nextToastAnnouncementId,
    scheduleToastDismiss,
  }),
  ...createUiStoreSettingsActions(set),
  ...createUiStoreSyncActions(set),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  openSidebar: () => set({ sidebarOpen: true, focusedPane: "sidebar" }),
  closeSidebar: () =>
    set((state) => ({
      sidebarOpen: false,
      accountPaneOpen: false,
      focusedPane: state.focusedPane === "sidebar" ? getSidebarHiddenFallbackPane(state) : state.focusedPane,
    })),
  toggleSidebar: () =>
    set((state) =>
      state.sidebarOpen
        ? {
            sidebarOpen: false,
            accountPaneOpen: false,
            focusedPane: state.focusedPane === "sidebar" ? getSidebarHiddenFallbackPane(state) : state.focusedPane,
          }
        : {
            sidebarOpen: true,
            focusedPane: "sidebar",
          },
    ),
  openAccountPane: () => set({ accountPaneOpen: true, sidebarOpen: true, focusedPane: "sidebar" }),
  closeAccountPane: () => set({ accountPaneOpen: false }),
  toggleAccountPane: () =>
    set((state) => ({
      accountPaneOpen: !state.accountPaneOpen,
      sidebarOpen: true,
      focusedPane: "sidebar",
    })),
  selectAccount: (id) =>
    set(
      getAccountSelectionResetState({
        selectedAccountId: id,
        selection: { type: "all" },
        focusedPane: "list",
      }),
    ),
  handleAccountDeleted: (deletedAccountId, remainingAccountIds) =>
    set((state) => {
      const fallbackAccountCandidates: Array<{ id: string }> = [];
      for (const accountId of remainingAccountIds) {
        const normalizedAccountId = accountId.trim();
        if (normalizedAccountId.length > 0 && normalizedAccountId !== deletedAccountId) {
          fallbackAccountCandidates.push({ id: normalizedAccountId });
        }
      }
      const fallbackAccountId = getPreferredAccountId(fallbackAccountCandidates, null);
      const nextState: Partial<UiState> = {};

      if (state.selectedAccountId === deletedAccountId) {
        Object.assign(
          nextState,
          getAccountSelectionResetState({
            selectedAccountId: fallbackAccountId,
            selection: { type: "all" },
            focusedPane: fallbackAccountId ? "list" : "sidebar",
          }),
        );
      }

      if (state.settingsAccountId === deletedAccountId) {
        Object.assign(nextState, getSettingsAccountsViewState(fallbackAccountId, false));
      }

      if (
        state.accountSetupSession &&
        "accountId" in state.accountSetupSession &&
        state.accountSetupSession.accountId === deletedAccountId
      ) {
        Object.assign(nextState, { accountSetupSession: null });
      }

      if (state.syncProgress.activeAccountIds.has(deletedAccountId)) {
        const activeAccountIds = new Set(state.syncProgress.activeAccountIds);
        activeAccountIds.delete(deletedAccountId);

        Object.assign(nextState, {
          syncProgress:
            activeAccountIds.size > 0
              ? {
                  ...state.syncProgress,
                  currentAccountName: null,
                  activeAccountIds,
                }
              : getIdleSyncProgress(),
        });
      }

      return nextState;
    }),
  restoreAccountSelection: (id, options) =>
    set(
      getAccountSelectionResetState({
        selectedAccountId: id,
        selection: { type: "smart", kind: "unread" },
        focusedPane: options?.focusedPane ?? "list",
      }),
    ),
  clearSelectedAccount: () =>
    set(
      getAccountSelectionResetState({
        selectedAccountId: null,
        selection: { type: "all" },
        focusedPane: "list",
      }),
    ),
  selectFeed: (feedId) =>
    set((state) =>
      state.subscriptionsWorkspace !== null ? state : getReaderScopeResetState({ type: "feed", feedId }),
    ),
  selectFeedFromCurrentContext: (feedId) =>
    set((state) =>
      state.subscriptionsWorkspace !== null
        ? state
        : getReaderScopeResetState({ type: "feed", feedId }, { viewMode: getContextAwareScopeViewMode(state) }),
    ),
  selectFolder: (folderId) =>
    set((state) =>
      getReaderScopeResetState(
        { type: "folder", folderId },
        { expandedFolderIds: new Set(state.expandedFolderIds).add(folderId) },
      ),
    ),
  selectFolderFromCurrentContext: (folderId) =>
    set((state) =>
      getReaderScopeResetState(
        { type: "folder", folderId },
        {
          viewMode: getContextAwareScopeViewMode(state),
          expandedFolderIds: new Set(state.expandedFolderIds).add(folderId),
        },
      ),
    ),
  selectSmartView: (kind) =>
    set(getReaderScopeResetState({ type: "smart", kind }, { viewMode: getSmartViewMode(kind) })),
  selectTag: (tagId) => set(getReaderScopeResetState({ type: "tag", tagId })),
  selectTagFromCurrentContext: (tagId) =>
    set((state) => getReaderScopeResetState({ type: "tag", tagId }, { viewMode: getContextAwareScopeViewMode(state) })),
  handleTagDeleted: (deletedTagId) =>
    set((state) => {
      if (state.selection.type !== "tag" || state.selection.tagId !== deletedTagId) {
        return state;
      }

      return {
        ...getReaderScopeResetState({ type: "all" }),
      };
    }),
  selectAll: () => set(getReaderScopeResetState({ type: "all" })),
  selectArticle: (id, options) =>
    set((state) =>
      state.subscriptionsWorkspace !== null
        ? state
        : (() => {
            const nextContentMode = state.contentMode === "browser" ? "browser" : "reader";
            return {
              accountPaneOpen: false,
              selectedArticleId: id,
              articleEngagement: options?.engagement ?? "reading",
              contentMode: nextContentMode,
              focusedPane: "content",
              articleNavigationDirection: options?.navigationDirection ?? null,
              retainedArticleIds: getRetainedArticleIdsAfterSelectingArticle({
                articleId: id,
                viewMode: state.viewMode,
                currentRetainedArticleIds: state.retainedArticleIds,
              }),
            };
          })(),
    ),
  clearArticle: () => set({ selectedArticleId: null, contentMode: "empty" }),
  openBrowser: (url) =>
    set({
      accountPaneOpen: false,
      contentMode: "browser",
      browserUrl: url,
      browserNavigationState: { canGoBack: false, canGoForward: false },
      focusedPane: "content",
      browserCloseInFlight: false,
      pendingBrowserCloseAction: null,
      pendingBrowserCloseActionQueue: [],
    }),
  closeBrowser: () => set((s) => getClosedBrowserReaderState(s)),
  setWebPreviewSessionMode: (mode) =>
    set((state) => ({
      webPreviewSessionMode: mode,
      ...(mode === "forced-off" && state.contentMode === "browser" ? getClosedBrowserReaderState(state) : {}),
    })),
  setBrowserNavigationState: (state) => set({ browserNavigationState: state }),
  setBrowserCloseInFlight: (inFlight) => set({ browserCloseInFlight: inFlight }),
  setPendingBrowserCloseAction: (action) =>
    set((state) =>
      action === null
        ? {
            pendingBrowserCloseAction: null,
            pendingBrowserCloseActionQueue: [],
          }
        : {
            pendingBrowserCloseAction: action,
            pendingBrowserCloseActionQueue: [...state.pendingBrowserCloseActionQueue, action],
          },
    ),
  setViewMode: (mode) =>
    set({
      viewMode: mode,
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
      articleReaderScrollPositions: new Map(),
    }),
  setHasNextArticle: (hasNext) => set({ hasNextArticle: hasNext }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFolder: (folderId) =>
    set((s) => {
      const next = new Set(s.expandedFolderIds);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return { expandedFolderIds: next };
    }),
  setExpandedFolders: (folderIds) => set({ expandedFolderIds: new Set(folderIds) }),
  setIsFeedsSectionOpen: (open) =>
    set((state) => ({
      isFeedsSectionOpen: typeof open === "function" ? open(state.isFeedsSectionOpen) : open,
    })),
  setIsTagsSectionOpen: (open) =>
    set((state) => ({
      isTagsSectionOpen: typeof open === "function" ? open(state.isTagsSectionOpen) : open,
    })),
  openSubscriptionsIndex: (returnState) =>
    set({
      accountPaneOpen: false,
      subscriptionsWorkspace: returnState
        ? {
            kind: "index",
            returnState: parse(SubscriptionsWorkspaceReturnStateSchema, returnState),
          }
        : { kind: "index" },
      focusedPane: "content",
    }),
  closeSubscriptionsWorkspace: () =>
    set((state) => ({
      accountPaneOpen: false,
      subscriptionsWorkspace: null,
      focusedPane: state.selectedArticleId ? "content" : "list",
    })),
  openCommandPalette: () => set({ commandPaletteOpen: true, shortcutsHelpOpen: false }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () =>
    set((s) => ({
      commandPaletteOpen: !s.commandPaletteOpen,
      shortcutsHelpOpen: !s.commandPaletteOpen ? false : s.shortcutsHelpOpen,
    })),
  openShortcutsHelp: () => set({ shortcutsHelpOpen: true, commandPaletteOpen: false }),
  closeShortcutsHelp: () => set({ shortcutsHelpOpen: false }),
  addRecentlyRead: (id) =>
    set((s) => {
      const next = new Set(s.recentlyReadIds);
      next.add(id);
      return { recentlyReadIds: next };
    }),
  removeRecentlyRead: (id) =>
    set((s) => {
      if (!s.recentlyReadIds.has(id)) {
        return s;
      }

      const next = new Set(s.recentlyReadIds);
      next.delete(id);
      return { recentlyReadIds: next };
    }),
  clearRecentlyRead: () => set({ recentlyReadIds: new Set() }),
  retainArticle: (id) =>
    set((s) => ({
      retainedArticleIds: addRetainedArticle(s.retainedArticleIds, id),
    })),
  retainArticles: (ids) =>
    set((s) => ({
      retainedArticleIds: addRetainedArticles(s.retainedArticleIds, ids),
    })),
  clearRetainedArticles: () => set({ retainedArticleIds: new Set() }),
  setArticleReaderScrollPosition: (articleId, scrollTop) =>
    set((state) => {
      const normalizedScrollTop = Math.max(0, Math.round(scrollTop));
      if (state.articleReaderScrollPositions.get(articleId) === normalizedScrollTop) {
        return state;
      }

      const articleReaderScrollPositions = new Map(state.articleReaderScrollPositions);
      articleReaderScrollPositions.set(articleId, normalizedScrollTop);
      return { articleReaderScrollPositions };
    }),
  setNativeLifecycleBlocker: (entry) =>
    set((state) => {
      const nativeLifecycleBlockers = new Map(state.nativeLifecycleBlockers);
      if (entry.dirty || entry.pending) {
        nativeLifecycleBlockers.set(entry.owner, entry);
      } else {
        nativeLifecycleBlockers.delete(entry.owner);
      }
      return { nativeLifecycleBlockers };
    }),
  clearNativeLifecycleBlocker: (owner) =>
    set((state) => {
      if (!state.nativeLifecycleBlockers.has(owner)) {
        return state;
      }
      const nativeLifecycleBlockers = new Map(state.nativeLifecycleBlockers);
      nativeLifecycleBlockers.delete(owner);
      return { nativeLifecycleBlockers };
    }),
  getNativeLifecycleBlockerSnapshot: () => createNativeLifecycleBlockerSnapshot(get().nativeLifecycleBlockers),
}));

const setUiStoreState = useUiStore.setState;
function setUiStoreStateWithToastCleanup(
  partial: UiStoreState | Partial<UiStoreState> | ((state: UiStoreState) => UiStoreState | Partial<UiStoreState>),
  replace?: false,
): void;
function setUiStoreStateWithToastCleanup(
  state: UiStoreState | ((state: UiStoreState) => UiStoreState),
  replace: true,
): void;
function setUiStoreStateWithToastCleanup(
  partial: UiStoreState | Partial<UiStoreState> | ((state: UiStoreState) => UiStoreState | Partial<UiStoreState>),
  replace?: boolean,
): void {
  if (typeof partial === "function") {
    const partialWithToastCleanup = (state: UiStoreState) => {
      const nextState = partial(state);
      if (
        typeof nextState === "object" &&
        nextState !== null &&
        "toastMessage" in nextState &&
        nextState.toastMessage === null
      ) {
        clearToastDismissTimer();
      }
      return nextState;
    };
    if (replace === true) {
      setUiStoreState(partialWithToastCleanup as (state: UiStoreState) => UiStoreState, true);
      return;
    }
    setUiStoreState(partialWithToastCleanup, false);
    return;
  }

  if (typeof partial === "object" && partial !== null && "toastMessage" in partial && partial.toastMessage === null) {
    clearToastDismissTimer();
  }
  if (replace === true) {
    setUiStoreState(partial as UiStoreState | ((state: UiStoreState) => UiStoreState), true);
    return;
  }
  setUiStoreState(partial, false);
}
useUiStore.setState = setUiStoreStateWithToastCleanup as typeof useUiStore.setState;
