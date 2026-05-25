import type { ComponentType } from "react";
import type { SyncProgressEventDto } from "@/api/schemas/sync-progress";
import type { ConfirmDialogVariant } from "@/components/shared/dialog.types";
import type { AccountSetupSession, AccountSetupSessionOwner } from "@/lib/account/account-setup-session.types";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import type {
  ArticleNavigationDirection,
  BrowserNavigationState,
  ContentMode,
  FocusedPane,
  LayoutMode,
  PendingBrowserCloseAction,
} from "@/lib/layout/layout-state.types";
import type { ReaderQuerySelection } from "@/lib/reader/reader-query";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import type { ToastData } from "@/lib/ui/toast.types";
import type { SubscriptionsWorkspaceReturnState } from "@/schemas/subscriptions-workspace";

export type UiStoreReaderSelection = ReaderQuerySelection;

type ToastAnnouncement = {
  id: number;
  message: string;
};

type SubscriptionsWorkspace = {
  kind: "index";
  returnState?: SubscriptionsWorkspaceReturnState;
};

export type NativeLifecycleBlockerOwner = "settings" | "add-feed" | "sync" | "updater" | "export" | "backup";

export type NativeLifecycleBlockerEntry = {
  owner: NativeLifecycleBlockerOwner;
  dirty: boolean;
  pending: boolean;
};

export type NativeLifecycleBlockerSnapshot = {
  dirty: boolean;
  pending: boolean;
  owners: NativeLifecycleBlockerOwner[];
};

export type { SyncProgressEventDto } from "@/api/schemas/sync-progress";

type SyncProgressStage = "started" | "account_started" | "account_finished" | "finished";
type SyncProgressKind = "manual_all" | "manual_account" | "automatic";

export type SyncProgressUiState = {
  active: boolean;
  sessionId: number | null;
  currentAccountName: string | null;
  activeAccountIds: Set<string>;
  kind: SyncProgressKind | null;
  stage: SyncProgressStage | null;
  total: number;
  completed: number;
};

export type UiState = {
  layoutMode: LayoutMode;
  focusedPane: FocusedPane;
  sidebarOpen: boolean;
  accountPaneOpen: boolean;
  contentMode: ContentMode;
  selectedAccountId: string | null;
  selection: UiStoreReaderSelection;
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
  toastAnnouncements: ToastAnnouncement[];
  recentlyReadIds: Set<string>;
  retainedArticleIds: Set<string>;
  articleReaderScrollPositions: Map<string, number>;
  confirmDialog: {
    open: boolean;
    message: string;
    actionLabel: string | null;
    actionAccessibleLabel: string | null;
    variant: ConfirmDialogVariant;
    icon: ComponentType<{ className?: string }> | null;
    onConfirm: (() => void | Promise<void>) | null;
  };
  nativeLifecycleBlockers: Map<NativeLifecycleBlockerOwner, NativeLifecycleBlockerEntry>;
};

export type UiActions = {
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
  clearToastAnnouncement: (id: number) => void;
  addRecentlyRead: (id: string) => void;
  removeRecentlyRead: (id: string) => void;
  clearRecentlyRead: () => void;
  retainArticle: (id: string) => void;
  clearRetainedArticles: () => void;
  setArticleReaderScrollPosition: (articleId: string, scrollTop: number) => void;
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
  setNativeLifecycleBlocker: (entry: NativeLifecycleBlockerEntry) => void;
  clearNativeLifecycleBlocker: (owner: NativeLifecycleBlockerOwner) => void;
  getNativeLifecycleBlockerSnapshot: () => NativeLifecycleBlockerSnapshot;
};

export type UiStoreState = UiState & UiActions;

export type UiStoreShellState = Pick<
  UiStoreState,
  | "layoutMode"
  | "focusedPane"
  | "sidebarOpen"
  | "accountPaneOpen"
  | "commandPaletteOpen"
  | "shortcutsHelpOpen"
  | "nativeLifecycleBlockers"
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
  | "articleReaderScrollPositions"
>;

export type UiStoreReaderSelectionState = UiStoreReaderState;

export type UiStoreSettingsState = Pick<
  UiStoreState,
  | "settingsOpen"
  | "settingsCategory"
  | "settingsAccountId"
  | "settingsAddAccount"
  | "settingsAddAccountInitialKind"
  | "settingsLoading"
>;

export type UiStoreSettingsModalState = UiStoreSettingsState;

export type UiStoreDialogState = Pick<
  UiStoreState,
  "isAddFeedDialogOpen" | "toastMessage" | "confirmDialog" | "accountSetupSession"
>;

export type UiStoreToastState = Pick<UiStoreState, "toastMessage" | "toastAnnouncements">;

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
  | "setArticleReaderScrollPosition"
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
  | "setArticleReaderScrollPosition"
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

export type UiStoreSettingsModalActions = UiStoreSettingsActions;

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

export type UiStoreToastActions = Pick<UiStoreState, "showToast" | "clearToast" | "clearToastAnnouncement">;

export type UiStoreSyncProgressActions = Pick<UiStoreState, "applySyncProgress" | "clearSyncProgress">;

export type UiStoreAccountSetupActions = Pick<
  UiStoreState,
  | "startAccountSetupVerification"
  | "startAccountSetup"
  | "markAccountSetupFailed"
  | "markAccountSetupSucceeded"
  | "clearAccountSetup"
>;
