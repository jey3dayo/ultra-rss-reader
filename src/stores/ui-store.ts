import type { ComponentType } from "react";
import { create } from "zustand";

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

type SyncProgressState = {
  active: boolean;
  kind: SyncProgressKind | null;
  total: number;
  completed: number;
  activeAccountIds: Set<string>;
};

type Selection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: "unread" | "starred" }
  | { type: "tag"; tagId: string }
  | { type: "all" };

type LayoutMode = "wide" | "compact" | "mobile";
type FocusedPane = "sidebar" | "list" | "content";
type ContentMode = "empty" | "reader" | "browser" | "loading";
export type SettingsCategory = "general" | "appearance" | "reading" | "shortcuts" | "actions" | "data" | "accounts";

function getSidebarHiddenFallbackPane(state: Pick<UiState, "contentMode">): FocusedPane {
  return state.contentMode === "empty" ? "list" : "content";
}

interface UiState {
  layoutMode: LayoutMode;
  focusedPane: FocusedPane;
  sidebarOpen: boolean;
  contentMode: ContentMode;
  selectedAccountId: string | null;
  selection: Selection;
  selectedArticleId: string | null;
  viewMode: "all" | "unread" | "starred";
  searchQuery: string;
  browserUrl: string | null;
  expandedFolderIds: Set<string>;
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsLoading: boolean;
  appLoading: boolean;
  feedCleanupOpen: boolean;
  syncProgress: SyncProgressState;
  commandPaletteOpen: boolean;
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
  setViewMode: (mode: "all" | "unread" | "starred") => void;
  setSearchQuery: (query: string) => void;
  toggleFolder: (folderId: string) => void;
  openSettings: (tab?: SettingsCategory) => void;
  closeSettings: () => void;
  openAddFeedDialog: () => void;
  closeAddFeedDialog: () => void;
  setSettingsCategory: (cat: SettingsCategory) => void;
  setSettingsAccountId: (id: string | null) => void;
  setSettingsAddAccount: (show: boolean) => void;
  setSettingsLoading: (loading: boolean) => void;
  setAppLoading: (loading: boolean) => void;
  openFeedCleanup: () => void;
  closeFeedCleanup: () => void;
  applySyncProgress: (event: SyncProgressEvent) => void;
  clearSyncProgress: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
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
  expandedFolderIds: new Set(),
  settingsOpen: false,
  settingsCategory: "general",
  settingsAccountId: null,
  settingsAddAccount: false,
  settingsLoading: false,
  appLoading: false,
  feedCleanupOpen: false,
  syncProgress: {
    active: false,
    kind: null,
    total: 0,
    completed: 0,
    activeAccountIds: new Set(),
  },
  commandPaletteOpen: false,
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
    set({
      selection: { type: "folder", folderId },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectSmartView: (kind) =>
    set({
      selection: { type: "smart", kind },
      viewMode: kind,
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
  openBrowser: (url) => set({ contentMode: "browser", browserUrl: url }),
  closeBrowser: () => set((s) => ({ contentMode: s.selectedArticleId ? "reader" : "empty", browserUrl: null })),
  setViewMode: (mode) => set({ viewMode: mode, recentlyReadIds: new Set(), retainedArticleIds: new Set() }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFolder: (folderId) =>
    set((s) => {
      const next = new Set(s.expandedFolderIds);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return { expandedFolderIds: next };
    }),
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
  openFeedCleanup: () => set({ feedCleanupOpen: true }),
  closeFeedCleanup: () => set({ feedCleanupOpen: false }),
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

      return {
        appLoading: true,
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
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    const data: ToastData = typeof message === "string" ? { message } : message;
    set({ toastMessage: data });
    if (!data.persistent) {
      toastTimer = setTimeout(() => {
        set({ toastMessage: null });
        toastTimer = null;
      }, 4000);
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
