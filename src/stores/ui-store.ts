import type { ComponentType } from "react";
import { create } from "zustand";
import { TOAST_AUTO_DISMISS_TIMEOUT_MS } from "../constants/ui-runtime";

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastData = {
  message: string;
  persistent?: boolean;
  progress?: number | null;
  actions?: ToastAction[];
};

export type SyncProgressStage = "started" | "account_started" | "account_finished" | "finished";
export type SyncProgressKind = "manual_all" | "manual_account" | "automatic";

export type SyncProgressEvent = {
  stage: SyncProgressStage;
  kind: SyncProgressKind;
  total: number;
  completed: number;
  account_id?: string | null;
  account_name?: string | null;
  success?: boolean | null;
};

export type SyncProgressState = {
  active: boolean;
  kind: SyncProgressKind | null;
  total: number;
  completed: number;
  activeAccountIds: Set<string>;
};

export type UiSelection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: "unread" | "starred" }
  | { type: "tag"; tagId: string }
  | { type: "all" };

export type LayoutMode = "wide" | "compact" | "mobile";
export type FocusedPane = "sidebar" | "list" | "content";
export type ContentMode = "empty" | "reader" | "browser" | "loading";
export type PendingBrowserCloseAction = "prev-article" | "next-article" | "prev-feed" | "next-feed";
export type FeedCleanupContextReason = "review" | "stale_90d" | "no_unread" | "no_stars" | "broken_references";
export type FeedCleanupContext = {
  reason: FeedCleanupContextReason;
  feedId?: string | null;
  returnTo: "index";
};
export type SubscriptionsWorkspace =
  | { kind: "index"; cleanupContext: null }
  | { kind: "cleanup"; cleanupContext: FeedCleanupContext | null };
export type SettingsCategory =
  | "general"
  | "appearance"
  | "reading"
  | "shortcuts"
  | "actions"
  | "data"
  | "debug"
  | "accounts";

function getSidebarHiddenFallbackPane(state: Pick<UiState, "contentMode">): FocusedPane {
  return state.contentMode === "empty" ? "list" : "content";
}

interface UiState {
  layoutMode: LayoutMode;
  focusedPane: FocusedPane;
  sidebarOpen: boolean;
  contentMode: ContentMode;
  selectedAccountId: string | null;
  selection: UiSelection;
  selectedArticleId: string | null;
  viewMode: "all" | "unread" | "starred";
  searchQuery: string;
  browserUrl: string | null;
  browserCloseInFlight: boolean;
  pendingBrowserCloseAction: PendingBrowserCloseAction | null;
  expandedFolderIds: Set<string>;
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsLoading: boolean;
  appLoading: boolean;
  subscriptionsWorkspace: SubscriptionsWorkspace | null;
  syncProgress: SyncProgressState;
  commandPaletteOpen: boolean;
  shortcutsHelpOpen: boolean;
  isAddFeedDialogOpen: boolean;
  toastMessage: ToastData | null;
  recentlyReadIds: Set<string>;
  retainedArticleIds: Set<string>;
  confirmDialog: {
    open: boolean;
    message: string;
    actionLabel: string | null;
    icon: ComponentType<{ className?: string }> | null;
    onConfirm: (() => void) | null;
  };
}

interface UiActions {
  setLayoutMode: (mode: LayoutMode) => void;
  setFocusedPane: (pane: FocusedPane) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  selectAccount: (id: string) => void;
  restoreAccountSelection: (id: string, options?: { focusedPane?: FocusedPane }) => void;
  clearSelectedAccount: () => void;
  selectFeed: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectSmartView: (kind: "unread" | "starred") => void;
  selectTag: (tagId: string) => void;
  selectAll: () => void;
  selectArticle: (id: string) => void;
  clearArticle: () => void;
  openBrowser: (url: string) => void;
  closeBrowser: () => void;
  setBrowserCloseInFlight: (inFlight: boolean) => void;
  setPendingBrowserCloseAction: (action: PendingBrowserCloseAction | null) => void;
  setViewMode: (mode: "all" | "unread" | "starred") => void;
  setSearchQuery: (query: string) => void;
  toggleFolder: (folderId: string) => void;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  openSettings: (tab?: SettingsCategory) => void;
  closeSettings: () => void;
  openAddFeedDialog: () => void;
  closeAddFeedDialog: () => void;
  setSettingsCategory: (cat: SettingsCategory) => void;
  setSettingsAccountId: (id: string | null) => void;
  setSettingsAddAccount: (show: boolean) => void;
  setSettingsLoading: (loading: boolean) => void;
  setAppLoading: (loading: boolean) => void;
  openSubscriptionsIndex: () => void;
  openFeedCleanup: (context?: FeedCleanupContext) => void;
  closeFeedCleanup: () => void;
  closeSubscriptionsWorkspace: () => void;
  applySyncProgress: (event: SyncProgressEvent) => void;
  clearSyncProgress: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;
  showToast: (message: string | ToastData) => void;
  clearToast: () => void;
  addRecentlyRead: (id: string) => void;
  clearRecentlyRead: () => void;
  retainArticle: (id: string) => void;
  clearRetainedArticles: () => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    options?: { actionLabel?: string; icon?: ComponentType<{ className?: string }> },
  ) => void;
  closeConfirm: () => void;
}

export type UiStoreState = UiState & UiActions;

const initialState: UiState = {
  layoutMode: "wide",
  focusedPane: "sidebar",
  sidebarOpen: true,
  contentMode: "empty",
  selectedAccountId: null,
  selection: { type: "all" },
  selectedArticleId: null,
  viewMode: "unread",
  searchQuery: "",
  browserUrl: null,
  browserCloseInFlight: false,
  pendingBrowserCloseAction: null,
  expandedFolderIds: new Set(),
  settingsOpen: false,
  settingsCategory: "general",
  settingsAccountId: null,
  settingsAddAccount: false,
  settingsLoading: false,
  appLoading: false,
  subscriptionsWorkspace: null,
  syncProgress: {
    active: false,
    kind: null,
    total: 0,
    completed: 0,
    activeAccountIds: new Set(),
  },
  commandPaletteOpen: false,
  shortcutsHelpOpen: false,
  isAddFeedDialogOpen: false,
  toastMessage: null,
  recentlyReadIds: new Set(),
  retainedArticleIds: new Set(),
  confirmDialog: { open: false, message: "", actionLabel: null, icon: null, onConfirm: null },
};

export const useUiStore = create<UiState & UiActions>()((set) => ({
  ...initialState,
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  openSidebar: () => set({ sidebarOpen: true, focusedPane: "sidebar" }),
  closeSidebar: () =>
    set((state) => ({
      sidebarOpen: false,
      focusedPane: state.focusedPane === "sidebar" ? getSidebarHiddenFallbackPane(state) : state.focusedPane,
    })),
  toggleSidebar: () =>
    set((state) =>
      state.sidebarOpen
        ? {
            sidebarOpen: false,
            focusedPane: state.focusedPane === "sidebar" ? getSidebarHiddenFallbackPane(state) : state.focusedPane,
          }
        : {
            sidebarOpen: true,
            focusedPane: "sidebar",
          },
    ),
  selectAccount: (id) =>
    set({
      selectedAccountId: id,
      selection: { type: "all" },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  restoreAccountSelection: (id, options) =>
    set({
      selectedAccountId: id,
      selection: { type: "smart", kind: "unread" },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: options?.focusedPane ?? "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  clearSelectedAccount: () =>
    set({
      selectedAccountId: null,
      selection: { type: "all" },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectFeed: (feedId) =>
    set({
      selection: { type: "feed", feedId },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectFolder: (folderId) =>
    set((state) => ({
      selection: { type: "folder", folderId },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      expandedFolderIds: new Set(state.expandedFolderIds).add(folderId),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  selectSmartView: (kind) =>
    set({
      selection: { type: "smart", kind },
      viewMode: kind === "starred" ? "all" : "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectTag: (tagId) =>
    set({
      selection: { type: "tag", tagId },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectAll: () =>
    set({
      selection: { type: "all" },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectArticle: (id) => set({ selectedArticleId: id, contentMode: "reader", focusedPane: "content" }),
  clearArticle: () => set({ selectedArticleId: null, contentMode: "empty" }),
  openBrowser: (url) =>
    set({
      contentMode: "browser",
      browserUrl: url,
      focusedPane: "content",
      browserCloseInFlight: false,
      pendingBrowserCloseAction: null,
    }),
  closeBrowser: () =>
    set((s) => ({
      contentMode: s.selectedArticleId ? "reader" : "empty",
      browserUrl: null,
      focusedPane: s.selectedArticleId ? "content" : "list",
      browserCloseInFlight: false,
    })),
  setBrowserCloseInFlight: (inFlight) => set({ browserCloseInFlight: inFlight }),
  setPendingBrowserCloseAction: (action) => set({ pendingBrowserCloseAction: action }),
  setViewMode: (mode) => set({ viewMode: mode, recentlyReadIds: new Set(), retainedArticleIds: new Set() }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFolder: (folderId) =>
    set((s) => {
      const next = new Set(s.expandedFolderIds);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return { expandedFolderIds: next };
    }),
  setExpandedFolders: (folderIds) => set({ expandedFolderIds: new Set(folderIds) }),
  openSettings: (tab?: SettingsCategory) =>
    set((s) => ({ settingsOpen: true, settingsCategory: tab ?? s.settingsCategory })),
  openAddFeedDialog: () => set({ isAddFeedDialogOpen: true }),
  closeAddFeedDialog: () => set({ isAddFeedDialogOpen: false }),
  closeSettings: () =>
    set({ settingsOpen: false, settingsCategory: "general", settingsAccountId: null, settingsAddAccount: false }),
  setSettingsCategory: (cat) => set({ settingsCategory: cat, settingsAccountId: null, settingsAddAccount: false }),
  setSettingsAccountId: (id) => set({ settingsAccountId: id, settingsAddAccount: false }),
  setSettingsAddAccount: (show) => set({ settingsAddAccount: show, settingsAccountId: null }),
  setSettingsLoading: (loading) => set({ settingsLoading: loading }),
  setAppLoading: (loading) => set({ appLoading: loading }),
  openSubscriptionsIndex: () =>
    set({
      subscriptionsWorkspace: { kind: "index", cleanupContext: null },
      focusedPane: "content",
    }),
  openFeedCleanup: (context) =>
    set({
      subscriptionsWorkspace: { kind: "cleanup", cleanupContext: context ?? null },
      focusedPane: "content",
    }),
  closeFeedCleanup: () =>
    set((state) => ({
      subscriptionsWorkspace: null,
      focusedPane: state.selectedArticleId ? "content" : "list",
    })),
  closeSubscriptionsWorkspace: () =>
    set((state) => ({
      subscriptionsWorkspace: null,
      focusedPane: state.selectedArticleId ? "content" : "list",
    })),
  applySyncProgress: (event) =>
    set((state) => {
      const activeAccountIds = new Set(state.syncProgress.activeAccountIds);
      if (event.account_id) {
        if (event.stage === "account_finished" || event.stage === "finished") {
          activeAccountIds.delete(event.account_id);
        } else {
          activeAccountIds.add(event.account_id);
        }
      }

      if (event.stage === "finished") {
        return {
          appLoading: false,
          syncProgress: {
            active: false,
            kind: null,
            total: 0,
            completed: 0,
            activeAccountIds: new Set(),
          },
        };
      }

      const shouldShowAppLoading = event.kind !== "manual_account";

      return {
        appLoading: shouldShowAppLoading,
        syncProgress: {
          active: true,
          kind: event.kind,
          total: event.total,
          completed: event.completed,
          activeAccountIds,
        },
      };
    }),
  clearSyncProgress: () =>
    set({
      appLoading: false,
      syncProgress: {
        active: false,
        kind: null,
        total: 0,
        completed: 0,
        activeAccountIds: new Set(),
      },
    }),
  openCommandPalette: () => set({ commandPaletteOpen: true, shortcutsHelpOpen: false }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () =>
    set((s) => ({
      commandPaletteOpen: !s.commandPaletteOpen,
      shortcutsHelpOpen: !s.commandPaletteOpen ? false : s.shortcutsHelpOpen,
    })),
  openShortcutsHelp: () => set({ shortcutsHelpOpen: true, commandPaletteOpen: false }),
  closeShortcutsHelp: () => set({ shortcutsHelpOpen: false }),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    const data: ToastData = typeof message === "string" ? { message } : message;
    set({ toastMessage: data });
    if (!data.persistent) {
      toastTimer = setTimeout(() => {
        set({ toastMessage: null });
        toastTimer = null;
      }, TOAST_AUTO_DISMISS_TIMEOUT_MS);
    }
  },
  clearToast: () => set({ toastMessage: null }),
  addRecentlyRead: (id) =>
    set((s) => {
      const next = new Set(s.recentlyReadIds);
      next.add(id);
      return { recentlyReadIds: next };
    }),
  clearRecentlyRead: () => set({ recentlyReadIds: new Set() }),
  retainArticle: (id) =>
    set((s) => {
      const next = new Set(s.retainedArticleIds);
      next.add(id);
      return { retainedArticleIds: next };
    }),
  clearRetainedArticles: () => set({ retainedArticleIds: new Set() }),
  showConfirm: (message, onConfirm, options) =>
    set({
      confirmDialog: {
        open: true,
        message,
        actionLabel: options?.actionLabel ?? null,
        icon: options?.icon ?? null,
        onConfirm,
      },
    }),
  closeConfirm: () =>
    set({ confirmDialog: { open: false, message: "", actionLabel: null, icon: null, onConfirm: null } }),
}));
