import type { ComponentType } from "react";
import { create } from "zustand";
import type { ConfirmDialogVariant } from "@/components/shared/dialog.types";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import { addRetainedArticle, getRetainedArticleIdsAfterSelectingArticle } from "@/lib/article-retention";
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
  variant?: "update";
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
  stage: SyncProgressStage | null;
  total: number;
  completed: number;
  currentAccountName: string | null;
  activeAccountIds: Set<string>;
};

export type AccountSetupSessionState = "syncing" | "failed" | "succeeded";

export type AccountSetupSession = {
  accountId: string;
  state: AccountSetupSessionState;
  errorMessage?: string;
};

export type UiSelection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: "unread" | "starred" | "recent" }
  | { type: "tag"; tagId: string }
  | { type: "all" };

export type LayoutMode = "wide" | "compact" | "mobile";
export type FocusedPane = "sidebar" | "list" | "content";
export type ContentMode = "empty" | "reader" | "browser" | "loading";
export type PendingBrowserCloseAction = "prev-article" | "next-article" | "prev-feed" | "next-feed";
export type BrowserNavigationState = {
  canGoBack: boolean;
  canGoForward: boolean;
};
export type SubscriptionSummaryFilterState = "all" | "review" | "stale";
export type SubscriptionsWorkspaceReturnState = {
  activeSummaryFilter: SubscriptionSummaryFilterState;
  selectedFeedId: string | null;
  expandedGroups: Record<string, boolean>;
  listScrollTop: number;
  keptFeedIds: string[];
  deferredFeedIds: string[];
};
export type SubscriptionsWorkspace = {
  kind: "index";
  returnState?: SubscriptionsWorkspaceReturnState;
};
export type SettingsCategory =
  | "general"
  | "appearance"
  | "mute"
  | "reading"
  | "shortcuts"
  | "actions"
  | "data"
  | "debug"
  | "tags"
  | "accounts";

function getSidebarHiddenFallbackPane(state: Pick<UiState, "contentMode">): FocusedPane {
  return state.contentMode === "empty" ? "list" : "content";
}

function getContextAwareScopeViewMode(state: Pick<UiState, "selection" | "viewMode">): "unread" | "starred" {
  return state.viewMode === "starred" || (state.selection.type === "smart" && state.selection.kind === "starred")
    ? "starred"
    : "unread";
}

function getSettingsAccountsViewState(
  accountId: string | null,
  addAccount: boolean,
  initialKind: AddAccountProviderKind | null = null,
) {
  if (addAccount) {
    return {
      settingsAccountId: null,
      settingsAddAccount: true,
      settingsAddAccountInitialKind: initialKind,
    };
  }

  return {
    settingsAccountId: accountId,
    settingsAddAccount: false,
    settingsAddAccountInitialKind: null,
  };
}

interface UiState {
  layoutMode: LayoutMode;
  focusedPane: FocusedPane;
  sidebarOpen: boolean;
  accountPaneOpen: boolean;
  contentMode: ContentMode;
  selectedAccountId: string | null;
  selection: UiSelection;
  selectedArticleId: string | null;
  viewMode: "all" | "unread" | "starred";
  searchQuery: string;
  browserUrl: string | null;
  browserNavigationState: BrowserNavigationState | null;
  browserCloseInFlight: boolean;
  pendingBrowserCloseAction: PendingBrowserCloseAction | null;
  expandedFolderIds: Set<string>;
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsAddAccountInitialKind: AddAccountProviderKind | null;
  settingsLoading: boolean;
  subscriptionsWorkspace: SubscriptionsWorkspace | null;
  syncProgress: SyncProgressState;
  accountSetupSession: AccountSetupSession | null;
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
    variant: ConfirmDialogVariant;
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
  openAccountPane: () => void;
  closeAccountPane: () => void;
  toggleAccountPane: () => void;
  selectAccount: (id: string) => void;
  restoreAccountSelection: (id: string, options?: { focusedPane?: FocusedPane }) => void;
  clearSelectedAccount: () => void;
  selectFeed: (feedId: string) => void;
  selectFeedFromCurrentContext: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectFolderFromCurrentContext: (folderId: string) => void;
  selectSmartView: (kind: "unread" | "starred" | "recent") => void;
  selectTag: (tagId: string) => void;
  selectTagFromCurrentContext: (tagId: string) => void;
  selectAll: () => void;
  selectArticle: (id: string) => void;
  clearArticle: () => void;
  openBrowser: (url: string) => void;
  closeBrowser: () => void;
  setBrowserNavigationState: (state: BrowserNavigationState | null) => void;
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
  openSettingsAccount: (id: string) => void;
  openSettingsAddAccount: (initialKind?: AddAccountProviderKind) => void;
  setSettingsAccountId: (id: string | null) => void;
  setSettingsAddAccount: (show: boolean, initialKind?: AddAccountProviderKind) => void;
  setSettingsAccountsView: (
    accountId: string | null,
    addAccount: boolean,
    initialKind?: AddAccountProviderKind,
  ) => void;
  setSettingsLoading: (loading: boolean) => void;
  openSubscriptionsIndex: (state?: SubscriptionsWorkspaceReturnState) => void;
  closeSubscriptionsWorkspace: () => void;
  applySyncProgress: (event: SyncProgressEvent) => void;
  clearSyncProgress: () => void;
  startAccountSetup: (accountId: string) => void;
  markAccountSetupFailed: (accountId: string, errorMessage?: string) => void;
  markAccountSetupSucceeded: (accountId: string) => void;
  clearAccountSetup: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;
  showToast: (message: string | ToastData) => void;
  clearToast: () => void;
  addRecentlyRead: (id: string) => void;
  removeRecentlyRead: (id: string) => void;
  clearRecentlyRead: () => void;
  retainArticle: (id: string) => void;
  clearRetainedArticles: () => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    options?: {
      actionLabel?: string;
      variant?: ConfirmDialogVariant;
      icon?: ComponentType<{ className?: string }>;
    },
  ) => void;
  closeConfirm: () => void;
}

export type UiStoreState = UiState & UiActions;

const initialState: UiState = {
  layoutMode: "wide",
  focusedPane: "sidebar",
  sidebarOpen: true,
  accountPaneOpen: false,
  contentMode: "empty",
  selectedAccountId: null,
  selection: { type: "all" },
  selectedArticleId: null,
  viewMode: "unread",
  searchQuery: "",
  browserUrl: null,
  browserNavigationState: null,
  browserCloseInFlight: false,
  pendingBrowserCloseAction: null,
  expandedFolderIds: new Set(),
  settingsOpen: false,
  settingsCategory: "general",
  settingsAccountId: null,
  settingsAddAccount: false,
  settingsAddAccountInitialKind: null,
  settingsLoading: false,
  subscriptionsWorkspace: null,
  syncProgress: {
    active: false,
    kind: null,
    stage: null,
    total: 0,
    completed: 0,
    currentAccountName: null,
    activeAccountIds: new Set(),
  },
  accountSetupSession: null,
  commandPaletteOpen: false,
  shortcutsHelpOpen: false,
  isAddFeedDialogOpen: false,
  toastMessage: null,
  recentlyReadIds: new Set(),
  retainedArticleIds: new Set(),
  confirmDialog: { open: false, message: "", actionLabel: null, variant: "default", icon: null, onConfirm: null },
};

export const useUiStore = create<UiState & UiActions>()((set) => ({
  ...initialState,
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
    set({
      selectedAccountId: id,
      accountPaneOpen: false,
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
      accountPaneOpen: false,
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
      accountPaneOpen: false,
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
      accountPaneOpen: false,
      selection: { type: "feed", feedId },
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectFeedFromCurrentContext: (feedId) =>
    set((state) => ({
      accountPaneOpen: false,
      selection: { type: "feed", feedId },
      viewMode: getContextAwareScopeViewMode(state),
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  selectFolder: (folderId) =>
    set((state) => ({
      accountPaneOpen: false,
      selection: { type: "folder", folderId },
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      expandedFolderIds: new Set(state.expandedFolderIds).add(folderId),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  selectFolderFromCurrentContext: (folderId) =>
    set((state) => ({
      accountPaneOpen: false,
      selection: { type: "folder", folderId },
      viewMode: getContextAwareScopeViewMode(state),
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      expandedFolderIds: new Set(state.expandedFolderIds).add(folderId),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  selectSmartView: (kind) =>
    set((state) => ({
      accountPaneOpen: false,
      selection: { type: "smart", kind },
      viewMode: kind === "unread" ? "unread" : state.viewMode,
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  selectTag: (tagId) =>
    set({
      accountPaneOpen: false,
      selection: { type: "tag", tagId },
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectTagFromCurrentContext: (tagId) =>
    set((state) => ({
      accountPaneOpen: false,
      selection: { type: "tag", tagId },
      viewMode: getContextAwareScopeViewMode(state),
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  selectAll: () =>
    set({
      accountPaneOpen: false,
      selection: { type: "all" },
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectArticle: (id) =>
    set((state) => ({
      accountPaneOpen: false,
      selectedArticleId: id,
      contentMode: "reader",
      focusedPane: "content",
      retainedArticleIds: getRetainedArticleIdsAfterSelectingArticle({
        articleId: id,
        viewMode: state.viewMode,
        currentRetainedArticleIds: state.retainedArticleIds,
      }),
    })),
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
    }),
  closeBrowser: () =>
    set((s) => ({
      accountPaneOpen: false,
      contentMode: s.selectedArticleId ? "reader" : "empty",
      browserUrl: null,
      browserNavigationState: null,
      focusedPane: s.selectedArticleId ? "content" : "list",
      browserCloseInFlight: false,
    })),
  setBrowserNavigationState: (state) => set({ browserNavigationState: state }),
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
    set({
      settingsOpen: false,
      settingsCategory: "general",
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
    }),
  setSettingsCategory: (cat) =>
    set({
      settingsCategory: cat,
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
    }),
  openSettingsAccount: (id) =>
    set({
      settingsOpen: true,
      settingsCategory: "accounts",
      ...getSettingsAccountsViewState(id, false),
    }),
  openSettingsAddAccount: (initialKind) =>
    set({
      settingsOpen: true,
      settingsCategory: "accounts",
      ...getSettingsAccountsViewState(null, true, initialKind ?? null),
    }),
  setSettingsAccountId: (id) => set(getSettingsAccountsViewState(id, false)),
  setSettingsAddAccount: (show, initialKind) => set(getSettingsAccountsViewState(null, show, initialKind ?? null)),
  setSettingsAccountsView: (accountId, addAccount, initialKind) =>
    set(getSettingsAccountsViewState(accountId, addAccount, initialKind ?? null)),
  setSettingsLoading: (loading) => set({ settingsLoading: loading }),
  openSubscriptionsIndex: (returnState) =>
    set({
      accountPaneOpen: false,
      subscriptionsWorkspace: { kind: "index", returnState },
      focusedPane: "content",
    }),
  closeSubscriptionsWorkspace: () =>
    set((state) => ({
      accountPaneOpen: false,
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
          syncProgress: {
            active: false,
            kind: null,
            stage: null,
            total: 0,
            completed: 0,
            currentAccountName: null,
            activeAccountIds: new Set(),
          },
        };
      }

      return {
        syncProgress: {
          active: true,
          kind: event.kind,
          stage: event.stage,
          total: event.total,
          completed: event.completed,
          currentAccountName: event.account_name ?? state.syncProgress.currentAccountName,
          activeAccountIds,
        },
      };
    }),
  clearSyncProgress: () =>
    set({
      syncProgress: {
        active: false,
        kind: null,
        stage: null,
        total: 0,
        completed: 0,
        currentAccountName: null,
        activeAccountIds: new Set(),
      },
    }),
  startAccountSetup: (accountId) =>
    set({
      accountSetupSession: {
        accountId,
        state: "syncing",
      },
    }),
  markAccountSetupFailed: (accountId, errorMessage) =>
    set((state) =>
      state.accountSetupSession?.accountId !== accountId
        ? state
        : {
            accountSetupSession: {
              accountId,
              state: "failed",
              ...(errorMessage ? { errorMessage } : {}),
            },
          },
    ),
  markAccountSetupSucceeded: (accountId) =>
    set((state) =>
      state.accountSetupSession?.accountId !== accountId
        ? state
        : {
            accountSetupSession: {
              accountId,
              state: "succeeded",
            },
          },
    ),
  clearAccountSetup: () => set({ accountSetupSession: null }),
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
  retainArticle: (id) => set((s) => ({ retainedArticleIds: addRetainedArticle(s.retainedArticleIds, id) })),
  clearRetainedArticles: () => set({ retainedArticleIds: new Set() }),
  showConfirm: (message, onConfirm, options) =>
    set({
      confirmDialog: {
        open: true,
        message,
        actionLabel: options?.actionLabel ?? null,
        variant: options?.variant ?? "default",
        icon: options?.icon ?? null,
        onConfirm,
      },
    }),
  closeConfirm: () =>
    set({
      confirmDialog: { open: false, message: "", actionLabel: null, variant: "default", icon: null, onConfirm: null },
    }),
}));
