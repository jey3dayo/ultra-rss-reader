import { parse } from "valibot";
import { create } from "zustand";
import type { FocusedPane } from "@/lib/layout/layout-state.types";
import { SubscriptionsWorkspaceReturnStateSchema } from "@/schemas/subscriptions-workspace";
import type {
  NativeLifecycleBlockerEntry,
  NativeLifecycleBlockerOwner,
  NativeLifecycleBlockerSnapshot,
  UiActions,
  UiState,
  UiStoreState,
} from "@/stores/ui-store.types";
import { createUiStoreDialogActions, type UiStoreDialogToastRuntime } from "@/stores/ui-store-dialog-actions";
import { createUiStoreReaderActions } from "@/stores/ui-store-reader-actions";
import { createUiStoreSettingsActions } from "@/stores/ui-store-settings-actions";
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
  ...createUiStoreReaderActions(set, {
    parseSubscriptionsWorkspaceReturnState: (returnState) =>
      parse(SubscriptionsWorkspaceReturnStateSchema, returnState),
  }),
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
  openCommandPalette: () => set({ commandPaletteOpen: true, shortcutsHelpOpen: false }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () =>
    set((s) => ({
      commandPaletteOpen: !s.commandPaletteOpen,
      shortcutsHelpOpen: !s.commandPaletteOpen ? false : s.shortcutsHelpOpen,
    })),
  openShortcutsHelp: () => set({ shortcutsHelpOpen: true, commandPaletteOpen: false }),
  closeShortcutsHelp: () => set({ shortcutsHelpOpen: false }),
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
