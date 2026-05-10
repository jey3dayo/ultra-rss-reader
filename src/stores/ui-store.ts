import type { ComponentType } from "react";
import { create } from "zustand";
import type { ConfirmDialogVariant } from "@/components/shared/dialog.types";
import { getPreferredAccountId } from "@/lib/account/account-selection";
import type { AccountSetupSession, AccountSetupSessionOwner } from "@/lib/account/account-setup-session.types";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import { addRetainedArticle, getRetainedArticleIdsAfterSelectingArticle } from "@/lib/articles/article-retention";
import type {
  ArticleNavigationDirection,
  BrowserNavigationState,
  ContentMode,
  FocusedPane,
  LayoutMode,
  PendingBrowserCloseAction,
} from "@/lib/layout/layout-state.types";
import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import {
  type SubscriptionsWorkspace,
  type SubscriptionsWorkspaceReturnState,
  SubscriptionsWorkspaceReturnStateSchema,
} from "@/lib/subscriptions/subscriptions-workspace.types";
import type { SyncProgressEventDto } from "@/lib/sync/sync-progress-event.types";
import type { SyncProgressUiState } from "@/lib/sync/sync-progress-state.types";
import type { ToastData } from "@/lib/ui/toast.types";
import { TOAST_AUTO_DISMISS_TIMEOUT_MS } from "../constants/ui-runtime";

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export type { SyncProgressEventDto } from "@/lib/sync/sync-progress-event.types";
export type { SyncProgressUiState } from "@/lib/sync/sync-progress-state.types";

function getSidebarHiddenFallbackPane(state: Pick<UiState, "contentMode">): FocusedPane {
  return state.contentMode === "empty" ? "list" : "content";
}

function getContextAwareScopeViewMode(state: Pick<UiState, "selection" | "viewMode">): "unread" | "starred" {
  return state.viewMode === "starred" || (state.selection.type === "smart" && state.selection.kind === "starred")
    ? "starred"
    : "unread";
}

function getSmartViewMode(kind: Extract<ReaderSelection, { type: "smart" }>["kind"]): UiState["viewMode"] {
  if (kind === "starred") {
    return "starred";
  }

  return kind === "recent" ? "all" : "unread";
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

function isSettingsSetupLocked(
  state: Pick<
    UiState,
    "accountSetupSession" | "settingsOpen" | "settingsCategory" | "settingsAccountId" | "settingsAddAccount"
  >,
): boolean {
  const { accountSetupSession } = state;
  if (!state.settingsOpen || accountSetupSession === null) {
    return false;
  }

  if (accountSetupSession.state === "verifying") {
    return state.settingsCategory === "accounts" && state.settingsAddAccount;
  }

  return (
    (accountSetupSession.state === "syncing" || accountSetupSession.state === "failed") &&
    state.settingsCategory === "accounts" &&
    state.settingsAccountId === accountSetupSession.accountId
  );
}

function canApplySettingsAccountTransition(
  state: Pick<
    UiState,
    "accountSetupSession" | "settingsOpen" | "settingsCategory" | "settingsAccountId" | "settingsAddAccount"
  >,
  accountId: string | null,
  addAccount: boolean,
): boolean {
  if (!isSettingsSetupLocked(state)) {
    return true;
  }

  const { accountSetupSession } = state;
  return (
    accountSetupSession !== null &&
    !addAccount &&
    accountSetupSession.state !== "verifying" &&
    accountSetupSession.accountId === accountId
  );
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

function normalizeAccountSetupAccountId(accountId: string) {
  const normalizedAccountId = accountId.trim();
  return normalizedAccountId.length > 0 ? normalizedAccountId : null;
}

function clearToastDismissTimer(): void {
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function normalizeSyncProgressCounts(event: Pick<SyncProgressEventDto, "total" | "completed">) {
  const total = Math.max(0, event.total);
  return {
    total,
    completed: Math.min(Math.max(0, event.completed), total),
  };
}

type UiState = {
  layoutMode: LayoutMode;
  focusedPane: FocusedPane;
  sidebarOpen: boolean;
  accountPaneOpen: boolean;
  contentMode: ContentMode;
  selectedAccountId: string | null;
  selection: ReaderSelection;
  selectedArticleId: string | null;
  viewMode: ViewMode;
  searchQuery: string;
  browserUrl: string | null;
  browserNavigationState: BrowserNavigationState | null;
  browserCloseInFlight: boolean;
  pendingBrowserCloseAction: PendingBrowserCloseAction | null;
  pendingBrowserCloseActionQueue: PendingBrowserCloseAction[];
  articleNavigationDirection: ArticleNavigationDirection | null;
  expandedFolderIds: Set<string>;
  isFeedsSectionOpen: boolean;
  isTagsSectionOpen: boolean;
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsAddAccountInitialKind: AddAccountProviderKind | null;
  settingsLoading: boolean;
  subscriptionsWorkspace: SubscriptionsWorkspace | null;
  syncProgress: SyncProgressUiState;
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
    actionAccessibleLabel: string | null;
    variant: ConfirmDialogVariant;
    icon: ComponentType<{ className?: string }> | null;
    onConfirm: (() => void | Promise<void>) | null;
  };
};

type UiActions = {
  setLayoutMode: (mode: LayoutMode) => void;
  setFocusedPane: (pane: FocusedPane) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  openAccountPane: () => void;
  closeAccountPane: () => void;
  toggleAccountPane: () => void;
  selectAccount: (id: string) => void;
  handleAccountDeleted: (deletedAccountId: string, remainingAccountIds: readonly string[]) => void;
  restoreAccountSelection: (id: string, options?: { focusedPane?: FocusedPane }) => void;
  clearSelectedAccount: () => void;
  selectFeed: (feedId: string) => void;
  selectFeedFromCurrentContext: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectFolderFromCurrentContext: (folderId: string) => void;
  selectSmartView: (kind: SmartViewKind) => void;
  selectTag: (tagId: string) => void;
  selectTagFromCurrentContext: (tagId: string) => void;
  handleTagDeleted: (deletedTagId: string) => void;
  selectAll: () => void;
  selectArticle: (id: string, options?: { navigationDirection?: ArticleNavigationDirection | null }) => void;
  clearArticle: () => void;
  openBrowser: (url: string) => void;
  closeBrowser: () => void;
  setBrowserNavigationState: (state: BrowserNavigationState | null) => void;
  setBrowserCloseInFlight: (inFlight: boolean) => void;
  setPendingBrowserCloseAction: (action: PendingBrowserCloseAction | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  toggleFolder: (folderId: string) => void;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  setIsFeedsSectionOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  setIsTagsSectionOpen: (open: boolean | ((current: boolean) => boolean)) => void;
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
  applySyncProgress: (event: SyncProgressEventDto) => void;
  clearSyncProgress: () => void;
  startAccountSetupVerification: () => void;
  startAccountSetup: (accountId: string, options?: { owner?: AccountSetupSessionOwner }) => void;
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
    onConfirm: () => void | Promise<void>,
    options?: {
      actionLabel?: string;
      actionAccessibleLabel?: string;
      variant?: ConfirmDialogVariant;
      icon?: ComponentType<{ className?: string }>;
    },
  ) => void;
  closeConfirm: () => void;
};

export type UiStoreState = UiState & UiActions;

export type UiStoreShellState = Pick<
  UiStoreState,
  "layoutMode" | "focusedPane" | "sidebarOpen" | "accountPaneOpen" | "commandPaletteOpen" | "shortcutsHelpOpen"
>;

export type UiStoreLayoutState = Pick<
  UiStoreState,
  "layoutMode" | "focusedPane" | "sidebarOpen" | "accountPaneOpen" | "subscriptionsWorkspace"
>;

export type UiStoreReaderState = Pick<
  UiStoreState,
  | "selectedAccountId"
  | "selection"
  | "selectedArticleId"
  | "viewMode"
  | "contentMode"
  | "browserUrl"
  | "browserNavigationState"
  | "browserCloseInFlight"
  | "pendingBrowserCloseAction"
  | "pendingBrowserCloseActionQueue"
  | "articleNavigationDirection"
  | "searchQuery"
  | "expandedFolderIds"
  | "isFeedsSectionOpen"
  | "isTagsSectionOpen"
  | "recentlyReadIds"
  | "retainedArticleIds"
>;

export type UiStoreReaderSelectionState = Pick<
  UiStoreState,
  | "selectedAccountId"
  | "selection"
  | "selectedArticleId"
  | "viewMode"
  | "contentMode"
  | "browserUrl"
  | "browserNavigationState"
  | "browserCloseInFlight"
  | "pendingBrowserCloseAction"
  | "pendingBrowserCloseActionQueue"
  | "articleNavigationDirection"
  | "searchQuery"
  | "expandedFolderIds"
  | "isFeedsSectionOpen"
  | "isTagsSectionOpen"
  | "recentlyReadIds"
  | "retainedArticleIds"
>;

export type UiStoreSettingsState = Pick<
  UiStoreState,
  | "settingsOpen"
  | "settingsCategory"
  | "settingsAccountId"
  | "settingsAddAccount"
  | "settingsAddAccountInitialKind"
  | "settingsLoading"
>;

export type UiStoreSettingsModalState = Pick<
  UiStoreState,
  | "settingsOpen"
  | "settingsCategory"
  | "settingsAccountId"
  | "settingsAddAccount"
  | "settingsAddAccountInitialKind"
  | "settingsLoading"
>;

export type UiStoreDialogState = Pick<
  UiStoreState,
  "isAddFeedDialogOpen" | "toastMessage" | "confirmDialog" | "accountSetupSession"
>;

export type UiStoreToastState = Pick<UiStoreState, "toastMessage">;

export type UiStoreSyncProgressState = Pick<UiStoreState, "syncProgress">;

export type UiStoreAccountSetupState = Pick<UiStoreState, "accountSetupSession">;

export type UiStoreLayoutActions = Pick<
  UiStoreState,
  | "setLayoutMode"
  | "setFocusedPane"
  | "openSidebar"
  | "closeSidebar"
  | "toggleSidebar"
  | "openAccountPane"
  | "closeAccountPane"
  | "toggleAccountPane"
  | "openSubscriptionsIndex"
  | "closeSubscriptionsWorkspace"
  | "openCommandPalette"
  | "closeCommandPalette"
  | "toggleCommandPalette"
  | "openShortcutsHelp"
  | "closeShortcutsHelp"
>;

export type UiStoreReaderActions = Pick<
  UiStoreState,
  | "selectAccount"
  | "handleAccountDeleted"
  | "restoreAccountSelection"
  | "clearSelectedAccount"
  | "selectFeed"
  | "selectFeedFromCurrentContext"
  | "selectFolder"
  | "selectFolderFromCurrentContext"
  | "selectSmartView"
  | "selectTag"
  | "selectTagFromCurrentContext"
  | "handleTagDeleted"
  | "selectAll"
  | "selectArticle"
  | "clearArticle"
  | "openBrowser"
  | "closeBrowser"
  | "setBrowserNavigationState"
  | "setBrowserCloseInFlight"
  | "setPendingBrowserCloseAction"
  | "setViewMode"
  | "setSearchQuery"
  | "toggleFolder"
  | "setExpandedFolders"
  | "setIsFeedsSectionOpen"
  | "setIsTagsSectionOpen"
  | "openSubscriptionsIndex"
  | "closeSubscriptionsWorkspace"
  | "addRecentlyRead"
  | "removeRecentlyRead"
  | "clearRecentlyRead"
  | "retainArticle"
  | "clearRetainedArticles"
>;

export type UiStoreReaderSelectionActions = Pick<
  UiStoreState,
  | "selectAccount"
  | "handleAccountDeleted"
  | "restoreAccountSelection"
  | "clearSelectedAccount"
  | "selectFeed"
  | "selectFeedFromCurrentContext"
  | "selectFolder"
  | "selectFolderFromCurrentContext"
  | "selectSmartView"
  | "selectTag"
  | "selectTagFromCurrentContext"
  | "handleTagDeleted"
  | "selectAll"
  | "selectArticle"
  | "clearArticle"
  | "openBrowser"
  | "closeBrowser"
  | "setBrowserNavigationState"
  | "setBrowserCloseInFlight"
  | "setPendingBrowserCloseAction"
  | "setViewMode"
  | "setSearchQuery"
  | "toggleFolder"
  | "setExpandedFolders"
  | "setIsFeedsSectionOpen"
  | "setIsTagsSectionOpen"
  | "addRecentlyRead"
  | "removeRecentlyRead"
  | "clearRecentlyRead"
  | "retainArticle"
  | "clearRetainedArticles"
>;

export type UiStoreSettingsActions = Pick<
  UiStoreState,
  | "openSettings"
  | "closeSettings"
  | "setSettingsCategory"
  | "openSettingsAccount"
  | "openSettingsAddAccount"
  | "setSettingsAccountId"
  | "setSettingsAddAccount"
  | "setSettingsAccountsView"
  | "setSettingsLoading"
>;

export type UiStoreSettingsModalActions = Pick<
  UiStoreState,
  | "openSettings"
  | "closeSettings"
  | "setSettingsCategory"
  | "openSettingsAccount"
  | "openSettingsAddAccount"
  | "setSettingsAccountId"
  | "setSettingsAddAccount"
  | "setSettingsAccountsView"
  | "setSettingsLoading"
>;

export type UiStoreDialogActions = Pick<
  UiStoreState,
  | "openAddFeedDialog"
  | "closeAddFeedDialog"
  | "showToast"
  | "clearToast"
  | "startAccountSetupVerification"
  | "startAccountSetup"
  | "markAccountSetupFailed"
  | "markAccountSetupSucceeded"
  | "clearAccountSetup"
  | "showConfirm"
  | "closeConfirm"
>;

export type UiStoreToastActions = Pick<UiStoreState, "showToast" | "clearToast">;

export type UiStoreSyncProgressActions = Pick<UiStoreState, "applySyncProgress" | "clearSyncProgress">;

export type UiStoreAccountSetupActions = Pick<
  UiStoreState,
  | "startAccountSetupVerification"
  | "startAccountSetup"
  | "markAccountSetupFailed"
  | "markAccountSetupSucceeded"
  | "clearAccountSetup"
>;

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
  pendingBrowserCloseActionQueue: [],
  articleNavigationDirection: null,
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
  confirmDialog: {
    open: false,
    message: "",
    actionLabel: null,
    actionAccessibleLabel: null,
    variant: "default",
    icon: null,
    onConfirm: null,
  },
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
      commandPaletteOpen: false,
      selection: { type: "all" },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      expandedFolderIds: new Set(),
      ...getResetBrowserState(),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  handleAccountDeleted: (deletedAccountId, remainingAccountIds) =>
    set((state) => {
      const fallbackAccountId = getPreferredAccountId(
        remainingAccountIds
          .map((accountId) => accountId.trim())
          .filter((accountId) => accountId.length > 0 && accountId !== deletedAccountId)
          .map((accountId) => ({ id: accountId })),
        null,
      );
      const nextState: Partial<UiState> = {};

      if (state.selectedAccountId === deletedAccountId) {
        Object.assign(nextState, {
          selectedAccountId: fallbackAccountId,
          accountPaneOpen: false,
          commandPaletteOpen: false,
          selection: { type: "all" },
          viewMode: "unread",
          selectedArticleId: null,
          contentMode: "empty",
          focusedPane: fallbackAccountId ? "list" : "sidebar",
          expandedFolderIds: new Set(),
          ...getResetBrowserState(),
          recentlyReadIds: new Set(),
          retainedArticleIds: new Set(),
        });
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
              : {
                  active: false,
                  kind: null,
                  stage: null,
                  total: 0,
                  completed: 0,
                  currentAccountName: null,
                  activeAccountIds,
                },
        });
      }

      return nextState;
    }),
  restoreAccountSelection: (id, options) =>
    set({
      selectedAccountId: id,
      accountPaneOpen: false,
      commandPaletteOpen: false,
      selection: { type: "smart", kind: "unread" },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: options?.focusedPane ?? "list",
      expandedFolderIds: new Set(),
      ...getResetBrowserState(),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  clearSelectedAccount: () =>
    set({
      selectedAccountId: null,
      accountPaneOpen: false,
      commandPaletteOpen: false,
      selection: { type: "all" },
      viewMode: "unread",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      expandedFolderIds: new Set(),
      ...getResetBrowserState(),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectFeed: (feedId) =>
    set((state) =>
      state.subscriptionsWorkspace !== null
        ? state
        : {
            accountPaneOpen: false,
            selection: { type: "feed", feedId },
            selectedArticleId: null,
            contentMode: "empty",
            focusedPane: "list",
            ...getResetBrowserState(),
            recentlyReadIds: new Set(),
            retainedArticleIds: new Set(),
          },
    ),
  selectFeedFromCurrentContext: (feedId) =>
    set((state) =>
      state.subscriptionsWorkspace !== null
        ? state
        : {
            accountPaneOpen: false,
            selection: { type: "feed", feedId },
            viewMode: getContextAwareScopeViewMode(state),
            selectedArticleId: null,
            contentMode: "empty",
            focusedPane: "list",
            ...getResetBrowserState(),
            recentlyReadIds: new Set(),
            retainedArticleIds: new Set(),
          },
    ),
  selectFolder: (folderId) =>
    set((state) => ({
      accountPaneOpen: false,
      selection: { type: "folder", folderId },
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      expandedFolderIds: new Set(state.expandedFolderIds).add(folderId),
      ...getResetBrowserState(),
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
      ...getResetBrowserState(),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  selectSmartView: (kind) =>
    set({
      accountPaneOpen: false,
      selection: { type: "smart", kind },
      viewMode: getSmartViewMode(kind),
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      ...getResetBrowserState(),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectTag: (tagId) =>
    set({
      accountPaneOpen: false,
      selection: { type: "tag", tagId },
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      ...getResetBrowserState(),
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
      ...getResetBrowserState(),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    })),
  handleTagDeleted: (deletedTagId) =>
    set((state) => {
      if (state.selection.type !== "tag" || state.selection.tagId !== deletedTagId) {
        return state;
      }

      return {
        accountPaneOpen: false,
        selection: { type: "all" },
        selectedArticleId: null,
        contentMode: "empty",
        focusedPane: "list",
        ...getResetBrowserState(),
        recentlyReadIds: new Set(),
        retainedArticleIds: new Set(),
      };
    }),
  selectAll: () =>
    set({
      accountPaneOpen: false,
      selection: { type: "all" },
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      ...getResetBrowserState(),
      recentlyReadIds: new Set(),
      retainedArticleIds: new Set(),
    }),
  selectArticle: (id, options) =>
    set((state) =>
      state.subscriptionsWorkspace !== null
        ? state
        : {
            accountPaneOpen: false,
            selectedArticleId: id,
            contentMode: "reader",
            focusedPane: "content",
            articleNavigationDirection: options?.navigationDirection ?? null,
            retainedArticleIds: getRetainedArticleIdsAfterSelectingArticle({
              articleId: id,
              viewMode: state.viewMode,
              currentRetainedArticleIds: state.retainedArticleIds,
            }),
          },
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
  closeBrowser: () =>
    set((s) => ({
      accountPaneOpen: false,
      contentMode: s.selectedArticleId ? "reader" : "empty",
      browserUrl: null,
      browserNavigationState: null,
      focusedPane: s.selectedArticleId ? "content" : "list",
      browserCloseInFlight: false,
      pendingBrowserCloseAction: null,
      pendingBrowserCloseActionQueue: [],
    })),
  setBrowserNavigationState: (state) => set({ browserNavigationState: state }),
  setBrowserCloseInFlight: (inFlight) => set({ browserCloseInFlight: inFlight }),
  setPendingBrowserCloseAction: (action) =>
    set((state) =>
      action === null
        ? { pendingBrowserCloseAction: null, pendingBrowserCloseActionQueue: [] }
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
    }),
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
  openSettings: (tab?: SettingsCategory) =>
    set((s) => ({
      settingsOpen: true,
      settingsCategory: isSettingsSetupLocked(s) ? s.settingsCategory : (tab ?? s.settingsCategory),
    })),
  openAddFeedDialog: () => set({ isAddFeedDialogOpen: true }),
  closeAddFeedDialog: () => set({ isAddFeedDialogOpen: false }),
  closeSettings: () =>
    set((state) =>
      isSettingsSetupLocked(state)
        ? state
        : {
            settingsOpen: false,
            settingsCategory: "general",
            settingsAccountId: null,
            settingsAddAccount: false,
            settingsAddAccountInitialKind: null,
            settingsLoading: false,
          },
    ),
  setSettingsCategory: (cat) =>
    set((state) =>
      isSettingsSetupLocked(state)
        ? state
        : {
            settingsCategory: cat,
            settingsAccountId: null,
            settingsAddAccount: false,
            settingsAddAccountInitialKind: null,
          },
    ),
  openSettingsAccount: (id) =>
    set((state) =>
      !canApplySettingsAccountTransition(state, id, false)
        ? state
        : {
            settingsOpen: true,
            settingsCategory: "accounts",
            ...getSettingsAccountsViewState(id, false),
          },
    ),
  openSettingsAddAccount: (initialKind) =>
    set((state) =>
      isSettingsSetupLocked(state)
        ? state
        : {
            settingsOpen: true,
            settingsCategory: "accounts",
            ...getSettingsAccountsViewState(null, true, initialKind ?? null),
          },
    ),
  setSettingsAccountId: (id) =>
    set((state) =>
      canApplySettingsAccountTransition(state, id, false) ? getSettingsAccountsViewState(id, false) : state,
    ),
  setSettingsAddAccount: (show, initialKind) =>
    set((state) =>
      canApplySettingsAccountTransition(state, null, show)
        ? getSettingsAccountsViewState(null, show, initialKind ?? null)
        : state,
    ),
  setSettingsAccountsView: (accountId, addAccount, initialKind) =>
    set((state) =>
      canApplySettingsAccountTransition(state, accountId, addAccount)
        ? getSettingsAccountsViewState(accountId, addAccount, initialKind ?? null)
        : state,
    ),
  setSettingsLoading: (loading) => set({ settingsLoading: loading }),
  openSubscriptionsIndex: (returnState) =>
    set({
      accountPaneOpen: false,
      subscriptionsWorkspace: returnState
        ? {
            kind: "index",
            returnState: SubscriptionsWorkspaceReturnStateSchema.parse(returnState),
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
  applySyncProgress: (event) =>
    set((state) => {
      const counts = normalizeSyncProgressCounts(event);
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
          total: counts.total,
          completed: counts.completed,
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
  startAccountSetupVerification: () =>
    set({
      accountSetupSession: {
        owner: "add-account",
        state: "verifying",
      },
    }),
  startAccountSetup: (accountId, options) =>
    set((state) => {
      const normalizedAccountId = normalizeAccountSetupAccountId(accountId);
      if (!normalizedAccountId) {
        return state;
      }

      return {
        accountSetupSession: {
          accountId: normalizedAccountId,
          owner: options?.owner ?? state.accountSetupSession?.owner ?? "account-detail",
          state: "syncing",
        },
      };
    }),
  markAccountSetupFailed: (accountId, errorMessage) =>
    set((state) => {
      const normalizedAccountId = normalizeAccountSetupAccountId(accountId);
      return !normalizedAccountId ||
        state.accountSetupSession?.state === "verifying" ||
        state.accountSetupSession?.accountId !== normalizedAccountId
        ? state
        : {
            accountSetupSession: {
              accountId: normalizedAccountId,
              owner: state.accountSetupSession.owner,
              state: "failed",
              ...(errorMessage ? { errorMessage } : {}),
            },
          };
    }),
  markAccountSetupSucceeded: (accountId) =>
    set((state) => {
      const normalizedAccountId = normalizeAccountSetupAccountId(accountId);
      return !normalizedAccountId ||
        state.accountSetupSession?.state === "verifying" ||
        state.accountSetupSession?.accountId !== normalizedAccountId
        ? state
        : {
            accountSetupSession: {
              accountId: normalizedAccountId,
              owner: state.accountSetupSession.owner,
              state: "succeeded",
            },
          };
    }),
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
    clearToastDismissTimer();
    const data: ToastData = typeof message === "string" ? { message } : message;
    set({ toastMessage: data });
    if (!data.persistent) {
      const dismissTimer = setTimeout(() => {
        set((state) => (state.toastMessage === data ? { toastMessage: null } : state));
        if (toastTimer === dismissTimer) {
          toastTimer = null;
        }
      }, TOAST_AUTO_DISMISS_TIMEOUT_MS);
      toastTimer = dismissTimer;
    }
  },
  clearToast: () => {
    clearToastDismissTimer();
    set({ toastMessage: null });
  },
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
  clearRetainedArticles: () => set({ retainedArticleIds: new Set() }),
  showConfirm: (message, onConfirm, options) =>
    set({
      confirmDialog: {
        open: true,
        message,
        actionLabel: options?.actionLabel ?? null,
        actionAccessibleLabel: options?.actionAccessibleLabel ?? null,
        variant: options?.variant ?? "default",
        icon: options?.icon ?? null,
        onConfirm,
      },
    }),
  closeConfirm: () =>
    set({
      confirmDialog: {
        open: false,
        message: "",
        actionLabel: null,
        actionAccessibleLabel: null,
        variant: "default",
        icon: null,
        onConfirm: null,
      },
    }),
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
