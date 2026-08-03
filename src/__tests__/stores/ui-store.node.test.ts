import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { SyncProgressRuntimeEventDto } from "@/api/schemas";
import { TOAST_AUTO_DISMISS_TIMEOUT_MS } from "@/constants/ui-runtime";
import { SubscriptionsWorkspaceReturnStateSchema } from "@/schemas/subscriptions-workspace";
import type {
  NativeLifecycleBlockerEntry,
  NativeLifecycleBlockerOwner,
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
} from "../../stores/ui-store";
import { useUiStore } from "../../stores/ui-store";

function getReaderStateSnapshot(state: UiStoreReaderState) {
  return {
    selectedAccountId: state.selectedAccountId,
    selection: state.selection,
    selectedArticleId: state.selectedArticleId,
    viewMode: state.viewMode,
    contentMode: state.contentMode,
    browserUrl: state.browserUrl,
    isFeedsSectionOpen: state.isFeedsSectionOpen,
    isTagsSectionOpen: state.isTagsSectionOpen,
  };
}

function getSettingsStateSnapshot(state: UiStoreSettingsState) {
  return {
    settingsOpen: state.settingsOpen,
    settingsCategory: state.settingsCategory,
    settingsAccountId: state.settingsAccountId,
    settingsAddAccount: state.settingsAddAccount,
    settingsAddAccountInitialKind: state.settingsAddAccountInitialKind,
    settingsLoading: state.settingsLoading,
  };
}

function setStaleBrowserState() {
  useUiStore.setState({
    contentMode: "browser",
    browserUrl: "https://example.com/preview",
    browserNavigationState: { canGoBack: true, canGoForward: true },
    browserCloseInFlight: true,
    pendingBrowserCloseAction: "next-article",
    pendingBrowserCloseActionQueue: ["next-article"],
  });
}

function expectBrowserStateReset() {
  expect(useUiStore.getState()).toEqual(
    expect.objectContaining({
      contentMode: "empty",
      browserUrl: null,
      browserNavigationState: null,
      browserCloseInFlight: false,
      pendingBrowserCloseAction: null,
      pendingBrowserCloseActionQueue: [],
    }),
  );
}

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial state defaults", () => {
    const s = useUiStore.getState();
    expect(s.layoutMode).toBe("wide");
    expect(s.contentMode).toBe("empty");
    expect(s.selection).toEqual({ type: "all" });
    expect(s.commandPaletteOpen).toBe(false);
    expect(s.sidebarOpen).toBe(true);
    expect(s.accountPaneOpen).toBe(false);
  });

  it("keeps typed slice inventories assignable from the current store", () => {
    expectTypeOf<UiStoreSettingsState>().toEqualTypeOf<
      Pick<
        UiStoreState,
        | "settingsOpen"
        | "settingsCategory"
        | "settingsAccountId"
        | "settingsAddAccount"
        | "settingsAddAccountInitialKind"
        | "settingsLoading"
      >
    >();
    expectTypeOf<UiStoreSettingsActions>().toEqualTypeOf<
      Pick<
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
      >
    >();
    expectTypeOf<UiStoreReaderSelectionState>().toEqualTypeOf<
      Pick<
        UiStoreState,
        | "selectedAccountId"
        | "selection"
        | "selectedArticleId"
        | "articleEngagement"
        | "viewMode"
        | "contentMode"
        | "browserUrl"
        | "webPreviewSessionMode"
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
      >
    >();
    expectTypeOf<UiStoreReaderSelectionActions>().toEqualTypeOf<
      Pick<
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
        | "setWebPreviewSessionMode"
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
        | "retainArticles"
        | "clearRetainedArticles"
        | "setArticleReaderScrollPosition"
      >
    >();
    expectTypeOf<UiStoreSettingsModalState>().toEqualTypeOf<UiStoreSettingsState>();
    expectTypeOf<UiStoreSettingsModalActions>().toEqualTypeOf<UiStoreSettingsActions>();
    expectTypeOf<UiStoreReaderState>().toHaveProperty("selection").toEqualTypeOf<UiStoreReaderSelection>();
    expectTypeOf<UiStoreState>().toHaveProperty("selection").toEqualTypeOf<UiStoreReaderSelection>();
    expectTypeOf<UiStoreState>()
      .toHaveProperty("nativeLifecycleBlockers")
      .toEqualTypeOf<Map<NativeLifecycleBlockerOwner, NativeLifecycleBlockerEntry>>();

    const state = useUiStore.getState();
    const shellState: UiStoreShellState = state;
    const layoutState: UiStoreLayoutState = state;
    const readerState: UiStoreReaderState = state;
    const readerSelectionState: UiStoreReaderSelectionState = state;
    const settingsState: UiStoreSettingsState = state;
    const settingsModalState: UiStoreSettingsModalState = state;
    const dialogState: UiStoreDialogState = state;
    const syncProgressState: UiStoreSyncProgressState = state;
    const accountSetupState: UiStoreAccountSetupState = state;
    const toastState: UiStoreToastState = state;
    const layoutActions: UiStoreLayoutActions = state;
    const readerActions: UiStoreReaderActions = state;
    const readerSelectionActions: UiStoreReaderSelectionActions = state;
    const settingsActions: UiStoreSettingsActions = state;
    const settingsModalActions: UiStoreSettingsModalActions = state;
    const dialogActions: UiStoreDialogActions = state;
    const syncProgressActions: UiStoreSyncProgressActions = state;
    const accountSetupActions: UiStoreAccountSetupActions = state;
    const toastActions: UiStoreToastActions = state;

    expect(shellState.sidebarOpen).toBe(true);
    expect(layoutState.focusedPane).toBe("sidebar");
    expect(readerState.selection).toEqual({ type: "all" });
    expect(readerSelectionState.selection).toEqual({ type: "all" });
    expect(settingsState.settingsOpen).toBe(false);
    expect(settingsModalState.settingsOpen).toBe(false);
    expect(dialogState.confirmDialog.open).toBe(false);
    expect(syncProgressState.syncProgress.active).toBe(false);
    expect(accountSetupState.accountSetupSession).toBeNull();
    expect(toastState.toastMessage).toBeNull();
    expect(toastState.toastAnnouncements).toEqual([]);
    expect(layoutActions.setFocusedPane).toBe(state.setFocusedPane);
    expect(readerActions.selectFeed).toBe(state.selectFeed);
    expect(readerSelectionActions.selectFeed).toBe(state.selectFeed);
    expect(settingsActions.openSettings).toBe(state.openSettings);
    expect(settingsModalActions.openSettings).toBe(state.openSettings);
    expect(dialogActions.showConfirm).toBe(state.showConfirm);
    expect(syncProgressActions.applySyncProgress).toBe(state.applySyncProgress);
    expect(accountSetupActions.startAccountSetup).toBe(state.startAccountSetup);
    expect(toastActions.showToast).toBe(state.showToast);
  });

  it("keeps sync progress runtime DTO and UI state type boundaries separate", () => {
    expectTypeOf<SyncProgressEventDto>().toEqualTypeOf<SyncProgressRuntimeEventDto>();
    expectTypeOf<SyncProgressRuntimeEventDto>().toHaveProperty("account_id").toEqualTypeOf<string | null | undefined>();
    expectTypeOf<SyncProgressRuntimeEventDto>()
      .toHaveProperty("account_name")
      .toEqualTypeOf<string | null | undefined>();
    expectTypeOf<SyncProgressRuntimeEventDto>().toHaveProperty("session_id").toEqualTypeOf<number>();
    expectTypeOf<SyncProgressUiState>().toHaveProperty("sessionId").toEqualTypeOf<number | null>();
    expectTypeOf<SyncProgressUiState>().toHaveProperty("currentAccountName").toEqualTypeOf<string | null>();
    expectTypeOf<SyncProgressUiState>().toHaveProperty("activeAccountIds").toEqualTypeOf<Set<string>>();

    const runtimeEvent = {
      stage: "account_started",
      session_id: 1,
      kind: "manual_account",
      total: 1,
      completed: 0,
      account_id: "acc-1",
      account_name: "FreshRSS",
    } satisfies SyncProgressRuntimeEventDto;
    const uiState = {
      active: true,
      sessionId: 1,
      kind: "manual_account",
      stage: "account_started",
      total: 1,
      completed: 0,
      currentAccountName: "FreshRSS",
      activeAccountIds: new Set(["acc-1"]),
    } satisfies SyncProgressUiState;

    expect(runtimeEvent.account_name).toBe("FreshRSS");
    expect(uiState.currentAccountName).toBe("FreshRSS");
    // @ts-expect-error Runtime sync progress events keep Rust/Tauri snake_case payload keys.
    void runtimeEvent.currentAccountName;
    // @ts-expect-error UI sync progress state keeps React/store camelCase keys.
    void uiState.account_name;
  });

  it("normalizes sync progress counts at the store boundary", () => {
    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 1,
      kind: "manual_all",
      total: 2,
      completed: 5,
      account_id: "acc-1",
      account_name: "FreshRSS",
    });

    expect(useUiStore.getState().syncProgress).toEqual(
      expect.objectContaining({
        active: true,
        sessionId: 1,
        total: 2,
        completed: 2,
        currentAccountName: "FreshRSS",
      }),
    );
    expect(useUiStore.getState().syncProgress.activeAccountIds).toEqual(new Set(["acc-1"]));

    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 2,
      kind: "manual_all",
      total: -2,
      completed: -1,
      account_id: "acc-2",
      account_name: null,
    });

    expect(useUiStore.getState().syncProgress).toEqual(
      expect.objectContaining({
        active: true,
        sessionId: 2,
        total: 0,
        completed: 0,
        currentAccountName: null,
      }),
    );
    expect(useUiStore.getState().syncProgress.activeAccountIds).toEqual(new Set(["acc-2"]));
  });

  it("keeps native lifecycle blockers as a dirty and pending close/restart contract", () => {
    useUiStore.getState().setNativeLifecycleBlocker({
      owner: "settings",
      dirty: true,
      pending: false,
    });
    useUiStore.getState().setNativeLifecycleBlocker({
      owner: "sync",
      dirty: false,
      pending: true,
    });

    expect(useUiStore.getState().getNativeLifecycleBlockerSnapshot()).toEqual({
      dirty: true,
      pending: true,
      owners: ["settings", "sync"],
    });

    useUiStore.getState().setNativeLifecycleBlocker({
      owner: "settings",
      dirty: false,
      pending: false,
    });

    expect(useUiStore.getState().getNativeLifecycleBlockerSnapshot()).toEqual({
      dirty: false,
      pending: true,
      owners: ["sync"],
    });

    useUiStore.getState().clearNativeLifecycleBlocker("sync");
    expect(useUiStore.getState().getNativeLifecycleBlockerSnapshot()).toEqual({
      dirty: false,
      pending: false,
      owners: [],
    });
  });

  it("keeps sync progress monotonic within a session and ignores older sessions", () => {
    useUiStore.getState().applySyncProgress({
      stage: "account_finished",
      session_id: 2,
      kind: "manual_all",
      total: 3,
      completed: 2,
      account_id: "acc-1",
      account_name: "FreshRSS",
      success: true,
    });

    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 2,
      kind: "manual_all",
      total: 3,
      completed: 1,
      account_id: "acc-2",
      account_name: "Second",
    });

    expect(useUiStore.getState().syncProgress).toEqual(
      expect.objectContaining({
        sessionId: 2,
        completed: 2,
        currentAccountName: "Second",
      }),
    );

    useUiStore.getState().applySyncProgress({
      stage: "account_finished",
      session_id: 1,
      kind: "manual_all",
      total: 3,
      completed: 3,
      account_id: "acc-stale",
      account_name: "Stale",
      success: true,
    });

    expect(useUiStore.getState().syncProgress).toEqual(
      expect.objectContaining({
        sessionId: 2,
        completed: 2,
        currentAccountName: "Second",
      }),
    );
    expect(useUiStore.getState().syncProgress.activeAccountIds).not.toContain("acc-stale");
  });

  it("updates renamed account labels from progress events without remapping the account id", () => {
    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 1,
      kind: "manual_account",
      total: 1,
      completed: 0,
      account_id: "acc-1",
      account_name: "FreshRSS",
    });

    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 1,
      kind: "manual_account",
      total: 1,
      completed: 0,
      account_id: "acc-1",
      account_name: "Renamed FreshRSS",
    });

    expect(useUiStore.getState().syncProgress).toEqual(
      expect.objectContaining({
        currentAccountName: "Renamed FreshRSS",
      }),
    );
    expect(useUiStore.getState().syncProgress.activeAccountIds).toEqual(new Set(["acc-1"]));
  });

  it("tracks unknown account ids from progress events until a completion event cleans them up", () => {
    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 1,
      kind: "manual_account",
      total: 1,
      completed: 0,
      account_id: "acc-unknown",
      account_name: "Unknown Account",
    });

    expect(useUiStore.getState().syncProgress.activeAccountIds).toEqual(new Set(["acc-unknown"]));

    useUiStore.getState().applySyncProgress({
      stage: "finished",
      session_id: 1,
      kind: "manual_account",
      total: 1,
      completed: 1,
      account_id: "acc-unknown",
      account_name: "Unknown Account",
      success: true,
    });

    expect(useUiStore.getState().syncProgress).toEqual({
      active: false,
      sessionId: null,
      kind: null,
      stage: null,
      total: 0,
      completed: 0,
      currentAccountName: null,
      activeAccountIds: new Set(),
    });
  });

  it("keeps sync active account ids unchanged when account progress omits the account id", () => {
    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 1,
      kind: "manual_all",
      total: 2,
      completed: 0,
      account_id: "acc-1",
      account_name: "FreshRSS",
    });

    useUiStore.getState().applySyncProgress({
      stage: "account_finished",
      session_id: 1,
      kind: "manual_all",
      total: 2,
      completed: 1,
      success: true,
    });

    expect(useUiStore.getState().syncProgress).toEqual(
      expect.objectContaining({
        active: true,
        total: 2,
        completed: 1,
        currentAccountName: "FreshRSS",
      }),
    );
    expect(useUiStore.getState().syncProgress.activeAccountIds).toEqual(new Set(["acc-1"]));
  });

  it("keeps all-account progress without an account id detached from account selection", () => {
    useUiStore.setState({ selectedAccountId: "acc-1" });

    useUiStore.getState().applySyncProgress({
      stage: "started",
      session_id: 1,
      kind: "manual_all",
      total: 2,
      completed: 0,
    });

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        selectedAccountId: "acc-1",
        syncProgress: expect.objectContaining({
          active: true,
          kind: "manual_all",
          currentAccountName: null,
          activeAccountIds: new Set(),
        }),
      }),
    );
  });

  it("removes deleted accounts from active sync progress and clears orphan progress", () => {
    useUiStore.getState().applySyncProgress({
      stage: "account_started",
      session_id: 1,
      kind: "manual_all",
      total: 2,
      completed: 0,
      account_id: "acc-1",
      account_name: "Deleted Account",
    });

    useUiStore.getState().handleAccountDeleted("acc-1", ["acc-2"]);

    expect(useUiStore.getState().syncProgress).toEqual(
      expect.objectContaining({
        active: false,
        kind: null,
        stage: null,
        total: 0,
        completed: 0,
        currentAccountName: null,
      }),
    );
    expect(useUiStore.getState().syncProgress.activeAccountIds).toEqual(new Set());
  });

  it("openCommandPalette sets true", () => {
    useUiStore.getState().openCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
  });

  it("closes the command palette when the selected account context changes", () => {
    useUiStore.getState().openCommandPalette();
    useUiStore.getState().selectAccount("acc-1");
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);

    useUiStore.getState().openCommandPalette();
    useUiStore.getState().restoreAccountSelection("acc-2");
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);

    useUiStore.getState().openCommandPalette();
    useUiStore.getState().clearSelectedAccount();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);

    useUiStore.setState({ selectedAccountId: "acc-3" });
    useUiStore.getState().openCommandPalette();
    useUiStore.getState().handleAccountDeleted("acc-3", ["acc-4"]);
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("resets expanded folders when the selected account context changes", () => {
    useUiStore.setState({ expandedFolderIds: new Set(["folder-1"]) });
    useUiStore.getState().selectAccount("acc-1");
    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set());

    useUiStore.setState({ expandedFolderIds: new Set(["folder-2"]) });
    useUiStore.getState().restoreAccountSelection("acc-2");
    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set());

    useUiStore.setState({ expandedFolderIds: new Set(["folder-3"]) });
    useUiStore.getState().clearSelectedAccount();
    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set());

    useUiStore.setState({
      selectedAccountId: "acc-3",
      expandedFolderIds: new Set(["folder-4"]),
    });
    useUiStore.getState().handleAccountDeleted("acc-3", ["acc-4"]);
    expect(useUiStore.getState().expandedFolderIds).toEqual(new Set());
  });

  it("does not fall back to the deleted account id when handling account deletion", () => {
    setStaleBrowserState();
    useUiStore.setState({
      selectedAccountId: "acc-1",
      settingsAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "article-1",
      accountSetupSession: {
        accountId: "acc-1",
        owner: "account-detail",
        state: "syncing",
      },
      recentlyReadIds: new Set(["article-1"]),
      retainedArticleIds: new Set(["article-1"]),
    });

    useUiStore.getState().handleAccountDeleted("acc-1", ["acc-1", " acc-2 "]);

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        selectedAccountId: "acc-2",
        settingsAccountId: "acc-2",
        selection: { type: "all" },
        selectedArticleId: null,
        focusedPane: "list",
        accountSetupSession: null,
      }),
    );
    expect(useUiStore.getState().recentlyReadIds).toEqual(new Set());
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());
    expectBrowserStateReset();
  });

  it("clears selected account state when deletion leaves no fallback account", () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      settingsAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "article-1",
    });

    useUiStore.getState().handleAccountDeleted("acc-1", ["acc-1", "   "]);

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        selectedAccountId: null,
        settingsAccountId: null,
        selection: { type: "all" },
        selectedArticleId: null,
        focusedPane: "sidebar",
      }),
    );
  });

  it("tracks account setup verification before an account id exists", () => {
    useUiStore.getState().startAccountSetupVerification();

    expect(useUiStore.getState().accountSetupSession).toEqual({
      owner: "add-account",
      state: "verifying",
    });

    useUiStore.getState().markAccountSetupFailed("acc-new", "Sync failed");
    expect(useUiStore.getState().accountSetupSession).toEqual({
      owner: "add-account",
      state: "verifying",
    });

    useUiStore.getState().startAccountSetup("acc-new");
    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-new",
      owner: "add-account",
      state: "syncing",
    });

    useUiStore.getState().markAccountSetupFailed("acc-new", "Sync failed");
    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-new",
      owner: "add-account",
      state: "failed",
      errorMessage: "Sync failed",
    });
  });

  it("keeps add-account verification locked at the settings store action boundary", () => {
    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: null,
      settingsAddAccount: true,
      settingsAddAccountInitialKind: "FreshRss",
    });
    useUiStore.getState().startAccountSetupVerification();

    useUiStore.getState().closeSettings();
    useUiStore.getState().setSettingsCategory("reading");
    useUiStore.getState().openSettingsAccount("acc-1");
    useUiStore.getState().setSettingsAccountsView("acc-1", false);

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        settingsOpen: true,
        settingsCategory: "accounts",
        settingsAccountId: null,
        settingsAddAccount: true,
        settingsAddAccountInitialKind: "FreshRss",
      }),
    );
  });

  it("keeps tracked account setup locked while allowing the active setup account transition", () => {
    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: null,
      settingsAddAccount: true,
    });
    useUiStore.getState().startAccountSetup("acc-1");

    useUiStore.getState().setSettingsAccountsView("acc-1", false);
    useUiStore.getState().closeSettings();
    useUiStore.getState().openSettingsAccount("acc-2");
    useUiStore.getState().openSettingsAddAccount();
    useUiStore.getState().setSettingsCategory("reading");

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        settingsOpen: true,
        settingsCategory: "accounts",
        settingsAccountId: "acc-1",
        settingsAddAccount: false,
        settingsAddAccountInitialKind: null,
      }),
    );
  });

  it("keeps account setup owner transitions scoped to the active setup session", () => {
    useUiStore.getState().startAccountSetupVerification();
    useUiStore.getState().markAccountSetupSucceeded("acc-add");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      owner: "add-account",
      state: "verifying",
    });

    useUiStore.getState().startAccountSetup("acc-add");
    useUiStore.getState().markAccountSetupSucceeded("acc-other");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-add",
      owner: "add-account",
      state: "syncing",
    });

    useUiStore.getState().startAccountSetup("acc-detail", { owner: "account-detail" });
    useUiStore.getState().markAccountSetupFailed("acc-add", "stale add-account result");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-detail",
      owner: "account-detail",
      state: "syncing",
    });

    useUiStore.getState().markAccountSetupFailed("acc-detail", "detail sync failed");

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-detail",
      owner: "account-detail",
      state: "failed",
      errorMessage: "detail sync failed",
    });
  });

  it("closeCommandPalette sets false", () => {
    useUiStore.getState().openCommandPalette();
    useUiStore.getState().closeCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggleCommandPalette toggles open state", () => {
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("opens and closes the subscriptions index workspace", () => {
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);

    useUiStore.getState().openSubscriptionsIndex();
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
    expect(useUiStore.getState().focusedPane).toBe("content");
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);

    useUiStore.getState().closeSubscriptionsWorkspace();
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);
    expect(useUiStore.getState().focusedPane).toBe("list");
  });

  it("keeps reader article and feed selection unchanged while subscriptions workspace is open", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      subscriptionsWorkspace: { kind: "index" },
      selection: { type: "feed", feedId: "feed-before" },
      selectedArticleId: "article-before",
      contentMode: "reader",
      focusedPane: "content",
      articleNavigationDirection: null,
      retainedArticleIds: new Set(["article-before"]),
    });

    useUiStore.getState().selectFeed("feed-after");
    useUiStore.getState().selectFeedFromCurrentContext("feed-current-context");
    useUiStore.getState().selectArticle("article-after", { navigationDirection: 1 });

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
    expect(useUiStore.getState().selection).toEqual({
      type: "feed",
      feedId: "feed-before",
    });
    expect(useUiStore.getState().selectedArticleId).toBe("article-before");
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().focusedPane).toBe("content");
    expect(useUiStore.getState().articleNavigationDirection).toBeNull();
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["article-before"]));
  });

  it("validates subscriptions index return state before storing it", () => {
    const returnState = {
      accountId: " acc-1 ",
      activeSummaryFilter: "stale",
      selectedFeedId: " feed-1 ",
      expandedGroups: {
        "group:subscription-list:1-folder:folder-1": false,
      },
      listScrollTop: {
        scrollTop: 18,
        layoutGeneration: "feed-1",
        viewportHeight: 720,
      },
      keptFeedIds: [" feed-2 "],
      deferredFeedIds: [" feed-3 "],
    } satisfies Parameters<UiStoreState["openSubscriptionsIndex"]>[0];

    useUiStore.getState().openSubscriptionsIndex(returnState);

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      returnState: {
        accountId: "acc-1",
        activeSummaryFilter: "stale",
        selectedFeedId: "feed-1",
        expandedGroups: {
          "group:subscription-list:1-folder:folder-1": false,
        },
        listScrollTop: {
          scrollTop: 18,
          layoutGeneration: "feed-1",
          viewportHeight: 720,
        },
        keptFeedIds: ["feed-2"],
        deferredFeedIds: ["feed-3"],
      },
    });

    expect(
      SubscriptionsWorkspaceReturnStateSchema.safeParse({
        accountId: "acc-1",
        activeSummaryFilter: "stale",
        selectedFeedId: "feed-1",
        expandedGroups: {
          "subscription-list:1-folder:folder-1": false,
        },
        listScrollTop: {
          scrollTop: 18,
          layoutGeneration: "feed-1",
          viewportHeight: 720,
        },
        keptFeedIds: [],
        deferredFeedIds: [],
      }).success,
    ).toBe(false);

    expect(
      SubscriptionsWorkspaceReturnStateSchema.safeParse({
        accountId: "acc-1",
        activeSummaryFilter: "stale",
        selectedFeedId: "feed-1",
        expandedGroups: {},
        listScrollTop: {
          scrollTop: 18,
          layoutGeneration: "feed-1",
          viewportHeight: 720,
        },
        keptFeedIds: [],
        deferredFeedIds: [],
        searchQuery: "do-not-restore",
        sortKey: "updated_at",
      }).success,
    ).toBe(false);

    expect(() =>
      useUiStore.getState().openSubscriptionsIndex({
        accountId: "acc-1",
        activeSummaryFilter: "stale",
        selectedFeedId: "feed-1",
        expandedGroups: {},
        listScrollTop: {
          scrollTop: -1,
          layoutGeneration: "feed-1",
          viewportHeight: 720,
        },
        keptFeedIds: [],
        deferredFeedIds: [],
      }),
    ).toThrow();
  });

  it("persists and restores the frequent summary filter without throwing at the schema boundary", () => {
    const returnState = {
      accountId: "acc-1",
      activeSummaryFilter: "frequent",
      selectedFeedId: "feed-1",
      expandedGroups: {},
      listScrollTop: {
        scrollTop: 0,
        layoutGeneration: "feed-1",
        viewportHeight: 720,
      },
      keptFeedIds: [],
      deferredFeedIds: [],
    } satisfies Parameters<UiStoreState["openSubscriptionsIndex"]>[0];

    expect(SubscriptionsWorkspaceReturnStateSchema.safeParse(returnState).success).toBe(true);
    expect(() => useUiStore.getState().openSubscriptionsIndex(returnState)).not.toThrow();
    expect(useUiStore.getState().subscriptionsWorkspace).toMatchObject({
      kind: "index",
      returnState: { activeSummaryFilter: "frequent" },
    });
  });

  it("selectFeed updates selection", () => {
    useUiStore.getState().selectFeed("f1");
    expect(useUiStore.getState().selection).toEqual({
      type: "feed",
      feedId: "f1",
    });
    expect(useUiStore.getState().selectedArticleId).toBeNull();
  });

  it("keeps reader scroll through browser return but clears it across reader scope changes", () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selectedArticleId: "article-1",
      contentMode: "reader",
      articleReaderScrollPositions: new Map([["article-1", 240]]),
    });

    useUiStore.getState().openBrowser("https://example.com/article-1");
    useUiStore.getState().closeBrowser();
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().articleReaderScrollPositions.get("article-1")).toBe(240);

    useUiStore.getState().selectFeed("feed-2");
    expect(useUiStore.getState().articleReaderScrollPositions.size).toBe(0);

    useUiStore.setState({
      articleReaderScrollPositions: new Map([["article-1", 240]]),
    });
    useUiStore.getState().selectAccount("acc-2");
    expect(useUiStore.getState().articleReaderScrollPositions.size).toBe(0);
  });

  it("context-aware subscription selection returns to unread outside starred context", () => {
    useUiStore.setState({ viewMode: "all", selection: { type: "all" } });

    useUiStore.getState().selectFeedFromCurrentContext("feed-1");
    expect(useUiStore.getState().selection).toEqual({
      type: "feed",
      feedId: "feed-1",
    });
    expect(useUiStore.getState().viewMode).toBe("unread");

    useUiStore.getState().selectFolderFromCurrentContext("folder-1");
    expect(useUiStore.getState().selection).toEqual({
      type: "folder",
      folderId: "folder-1",
    });
    expect(useUiStore.getState().viewMode).toBe("unread");
    expect(useUiStore.getState().expandedFolderIds.has("folder-1")).toBe(true);

    useUiStore.getState().selectTagFromCurrentContext("tag-1");
    expect(useUiStore.getState().selection).toEqual({
      type: "tag",
      tagId: "tag-1",
    });
    expect(useUiStore.getState().viewMode).toBe("unread");
  });

  it("context-aware subscription selection preserves starred context", () => {
    useUiStore.setState({
      selection: { type: "smart", kind: "starred" },
      viewMode: "all",
    });
    useUiStore.getState().selectFeedFromCurrentContext("feed-1");
    expect(useUiStore.getState().selection).toEqual({
      type: "feed",
      feedId: "feed-1",
    });
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.setState({ selection: { type: "all" }, viewMode: "starred" });
    useUiStore.getState().selectFolderFromCurrentContext("folder-1");
    expect(useUiStore.getState().selection).toEqual({
      type: "folder",
      folderId: "folder-1",
    });
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.setState({
      selection: { type: "smart", kind: "starred" },
      viewMode: "all",
    });
    useUiStore.getState().selectTagFromCurrentContext("tag-1");
    expect(useUiStore.getState().selection).toEqual({
      type: "tag",
      tagId: "tag-1",
    });
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("keeps the current footer filter when selecting a feed", () => {
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectFeed("f1");
    expect(useUiStore.getState().viewMode).toBe("all");

    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectFeed("f2");
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("selectSmartView('unread') keeps unread as a complete smart view without footer filtering", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectSmartView("unread");

    expect(useUiStore.getState().selection).toEqual({
      type: "smart",
      kind: "unread",
    });
    expect(useUiStore.getState().viewMode).toBe("unread");
  });

  it("selectSmartView('starred') selects the starred footer filter", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectSmartView("starred");

    expect(useUiStore.getState().selection).toEqual({
      type: "smart",
      kind: "starred",
    });
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectSmartView("starred");
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("selectSmartView('recent') selects the all footer filter", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectSmartView("recent");

    expect(useUiStore.getState().selection).toEqual({
      type: "smart",
      kind: "recent",
    });
    expect(useUiStore.getState().viewMode).toBe("all");

    useUiStore.getState().setViewMode("unread");
    useUiStore.getState().selectSmartView("recent");
    expect(useUiStore.getState().viewMode).toBe("all");
  });

  it("keeps the current footer filter when changing list scopes", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectFolder("folder-1");
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectTag("tag-1");
    expect(useUiStore.getState().viewMode).toBe("all");

    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectAll();
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("falls back from a deleted selected tag and ignores unrelated deleted tags", () => {
    useUiStore.getState().selectTag("tag-1");
    useUiStore.getState().selectArticle("article-1");
    setStaleBrowserState();

    useUiStore.getState().handleTagDeleted("tag-2");

    expect(useUiStore.getState().selection).toEqual({
      type: "tag",
      tagId: "tag-1",
    });
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/preview");

    useUiStore.getState().handleTagDeleted("tag-1");

    expect(useUiStore.getState().selection).toEqual({ type: "all" });
    expect(useUiStore.getState().selectedArticleId).toBeNull();
    expectBrowserStateReset();
  });

  it("clears stale browser state when switching reader scopes", () => {
    const cases = [
      ["selectAccount", () => useUiStore.getState().selectAccount("acc-1")],
      ["selectFeed", () => useUiStore.getState().selectFeed("feed-1")],
      ["selectFeedFromCurrentContext", () => useUiStore.getState().selectFeedFromCurrentContext("feed-1")],
      ["selectSmartView", () => useUiStore.getState().selectSmartView("unread")],
      ["selectTag", () => useUiStore.getState().selectTag("tag-1")],
      ["selectTagFromCurrentContext", () => useUiStore.getState().selectTagFromCurrentContext("tag-1")],
    ] as const;

    for (const [name, runAction] of cases) {
      useUiStore.setState(useUiStore.getInitialState());
      setStaleBrowserState();

      runAction();

      expectBrowserStateReset();
      expect(useUiStore.getState().focusedPane, name).toBe("list");
    }
  });

  it("selectArticle sets reader mode", () => {
    useUiStore.getState().selectArticle("a1");
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().selectedArticleId).toBe("a1");
  });

  it("tracks automatic article landing as preview", () => {
    useUiStore.getState().selectArticle("a1", { engagement: "preview" });

    expect(useUiStore.getState().selectedArticleId).toBe("a1");
    expect(useUiStore.getState().articleEngagement).toBe("preview");
  });

  it("defaults direct selection to reading and promotes the same previewed article", () => {
    useUiStore.getState().selectArticle("a1", { engagement: "preview" });
    useUiStore.getState().selectArticle("a1");

    expect(useUiStore.getState().selectedArticleId).toBe("a1");
    expect(useUiStore.getState().articleEngagement).toBe("reading");
  });

  it("keeps selected articles retained in unread mode until the screen changes", () => {
    useUiStore.getState().retainArticle("art-1");
    useUiStore.getState().selectArticle("art-1");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));

    useUiStore.getState().selectArticle("art-2");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1", "art-2"]));
  });

  it("does not change retained articles when selecting in all mode", () => {
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().retainArticle("art-1");

    useUiStore.getState().selectArticle("art-2");

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("openBrowser switches mode", () => {
    useUiStore.getState().openBrowser("https://ex.com");
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe("https://ex.com");
    expect(useUiStore.getState().focusedPane).toBe("content");
  });

  it("closeBrowser returns to reader and list focus if article selected", () => {
    useUiStore.getState().selectArticle("a1");
    useUiStore.getState().closeSidebar();
    useUiStore.getState().openBrowser("https://ex.com");
    useUiStore.getState().closeBrowser();
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().focusedPane).toBe("list");
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it("closeBrowser returns to the list when no article is selected", () => {
    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().closeSidebar();
    useUiStore.getState().openBrowser("https://ex.com");
    useUiStore.getState().closeBrowser();

    expect(useUiStore.getState().contentMode).toBe("empty");
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(useUiStore.getState().focusedPane).toBe("list");
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it("closeBrowser clears in-flight browser state and returns focus to the list", () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com",
      browserCloseInFlight: true,
      pendingBrowserCloseAction: "next-article",
      pendingBrowserCloseActionQueue: ["next-article"],
      focusedPane: "sidebar",
    });

    useUiStore.getState().closeBrowser();

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        contentMode: "reader",
        browserUrl: null,
        browserNavigationState: null,
        browserCloseInFlight: false,
        pendingBrowserCloseAction: null,
        pendingBrowserCloseActionQueue: [],
        sidebarOpen: true,
        focusedPane: "list",
      }),
    );

    useUiStore.setState({
      selectedArticleId: null,
      contentMode: "browser",
      browserUrl: "https://example.com",
      browserCloseInFlight: true,
      pendingBrowserCloseAction: "next-article",
      pendingBrowserCloseActionQueue: ["next-article"],
      focusedPane: "content",
    });

    useUiStore.getState().closeBrowser();

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        contentMode: "empty",
        browserUrl: null,
        browserNavigationState: null,
        browserCloseInFlight: false,
        pendingBrowserCloseAction: null,
        pendingBrowserCloseActionQueue: [],
        focusedPane: "list",
      }),
    );
  });

  it("forcing Web Preview off exits browser mode and restores sidebar navigation", () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com",
      browserNavigationState: { canGoBack: true, canGoForward: false },
      browserCloseInFlight: true,
      pendingBrowserCloseAction: "next-article",
      pendingBrowserCloseActionQueue: ["next-article"],
      sidebarOpen: false,
      focusedPane: "content",
    });

    useUiStore.getState().setWebPreviewSessionMode("forced-off");

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        webPreviewSessionMode: "forced-off",
        contentMode: "reader",
        browserUrl: null,
        browserNavigationState: null,
        browserCloseInFlight: false,
        pendingBrowserCloseAction: null,
        pendingBrowserCloseActionQueue: [],
        sidebarOpen: true,
        focusedPane: "list",
      }),
    );
  });

  it("toggleFolder adds and removes", () => {
    useUiStore.getState().toggleFolder("f1");
    expect(useUiStore.getState().expandedFolderIds.has("f1")).toBe(true);
    useUiStore.getState().toggleFolder("f1");
    expect(useUiStore.getState().expandedFolderIds.has("f1")).toBe(false);
  });

  it("focuses the list pane for list-oriented selections", () => {
    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectAccount("acc-1");
    expect(useUiStore.getState().focusedPane).toBe("list");

    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectFolder("folder-1");
    expect(useUiStore.getState().focusedPane).toBe("list");

    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectSmartView("unread");
    expect(useUiStore.getState().focusedPane).toBe("list");

    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectAll();
    expect(useUiStore.getState().focusedPane).toBe("list");
  });

  it("keeps settings state stable when reader selection actions run", () => {
    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: "acc-settings",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: true,
    });
    const before = getSettingsStateSnapshot(useUiStore.getState());

    useUiStore.getState().selectFeed("feed-1");

    expect(getSettingsStateSnapshot(useUiStore.getState())).toEqual(before);
  });

  it("keeps reader state stable when settings navigation actions run", () => {
    useUiStore.setState({
      selectedAccountId: "acc-reader",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "article-1",
      viewMode: "starred",
      contentMode: "reader",
      browserUrl: null,
    });
    const before = getReaderStateSnapshot(useUiStore.getState());

    useUiStore.getState().openSettingsAccount("acc-settings");
    useUiStore.getState().setSettingsLoading(true);
    useUiStore.getState().closeSettings();

    expect(getReaderStateSnapshot(useUiStore.getState())).toEqual(before);
  });

  it("resets settings loading when settings close", () => {
    useUiStore.getState().openSettings("data");
    useUiStore.getState().setSettingsLoading(true);

    useUiStore.getState().closeSettings();

    expect(useUiStore.getState().settingsLoading).toBe(false);
  });

  it("clears retained articles when the user changes the current screen", () => {
    useUiStore.getState().retainArticle("art-1");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));

    useUiStore.getState().setViewMode("starred");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());

    useUiStore.getState().retainArticle("art-2");
    useUiStore.getState().selectFeed("feed-1");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());
  });

  it("toggleSidebar closes the wide sidebar and falls back to the content pane when needed", () => {
    useUiStore.setState({
      layoutMode: "wide",
      focusedPane: "sidebar",
      selectedArticleId: "art-1",
      contentMode: "reader",
    });

    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().sidebarOpen).toBe(false);
    expect(useUiStore.getState().focusedPane).toBe("content");
  });

  it("openSidebar reopens the sidebar and focuses it", () => {
    useUiStore.setState({
      layoutMode: "wide",
      sidebarOpen: false,
      focusedPane: "content",
      selectedArticleId: "art-1",
      contentMode: "reader",
    });

    useUiStore.getState().openSidebar();

    expect(useUiStore.getState().sidebarOpen).toBe(true);
    expect(useUiStore.getState().focusedPane).toBe("sidebar");
  });

  it("opens, closes, and toggles the transient account pane", () => {
    useUiStore.getState().openAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(true);

    useUiStore.getState().toggleAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);

    useUiStore.getState().toggleAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(true);

    useUiStore.getState().closeAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);
  });

  it("closes the account pane when navigation leaves the account rail context", () => {
    useUiStore.setState({ accountPaneOpen: true });

    useUiStore.getState().selectAccount("acc-1");
    expect(useUiStore.getState().accountPaneOpen).toBe(false);

    useUiStore.setState({ accountPaneOpen: true, focusedPane: "sidebar" });
    useUiStore.getState().closeSidebar();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);

    useUiStore.setState({ accountPaneOpen: true });
    useUiStore.getState().openSubscriptionsIndex();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);
  });

  it("falls back the selected reader account when the current account is deleted", () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      accountPaneOpen: true,
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "article-1",
      contentMode: "reader",
      browserUrl: "https://example.com/deleted-account",
      browserNavigationState: { canGoBack: true, canGoForward: true },
      browserCloseInFlight: true,
      pendingBrowserCloseAction: "next-article",
      pendingBrowserCloseActionQueue: ["next-article"],
      viewMode: "starred",
      focusedPane: "content",
      recentlyReadIds: new Set(["article-1"]),
      retainedArticleIds: new Set(["article-1"]),
      accountSetupSession: {
        accountId: "acc-1",
        owner: "account-detail",
        state: "syncing",
      },
    });

    useUiStore.getState().handleAccountDeleted("acc-1", ["acc-2"]);

    expect(useUiStore.getState().selectedAccountId).toBe("acc-2");
    expect(useUiStore.getState().accountPaneOpen).toBe(false);
    expect(useUiStore.getState().selection).toEqual({ type: "all" });
    expect(useUiStore.getState().selectedArticleId).toBeNull();
    expect(useUiStore.getState().contentMode).toBe("empty");
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(useUiStore.getState().browserNavigationState).toBeNull();
    expect(useUiStore.getState().browserCloseInFlight).toBe(false);
    expect(useUiStore.getState().pendingBrowserCloseAction).toBeNull();
    expect(useUiStore.getState().pendingBrowserCloseActionQueue).toEqual([]);
    expect(useUiStore.getState().viewMode).toBe("unread");
    expect(useUiStore.getState().focusedPane).toBe("list");
    expect(useUiStore.getState().recentlyReadIds).toEqual(new Set());
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());
    expect(useUiStore.getState().accountSetupSession).toBeNull();

    useUiStore.getState().handleAccountDeleted("acc-2", []);

    expect(useUiStore.getState().selectedAccountId).toBeNull();
    expect(useUiStore.getState().focusedPane).toBe("sidebar");
  });

  it("falls back settings account detail without changing unrelated reader or setup state", () => {
    useUiStore.setState({
      selectedAccountId: "reader-acc",
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: "acc-1",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      accountSetupSession: {
        accountId: "setup-acc",
        owner: "account-detail",
        state: "syncing",
      },
    });

    useUiStore.getState().handleAccountDeleted("acc-1", ["acc-2"]);

    expect(useUiStore.getState().selectedAccountId).toBe("reader-acc");
    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "setup-acc",
      owner: "account-detail",
      state: "syncing",
    });
    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    expect(useUiStore.getState().settingsAddAccount).toBe(false);
    expect(useUiStore.getState().settingsAddAccountInitialKind).toBeNull();

    useUiStore.getState().handleAccountDeleted("acc-2", []);

    expect(useUiStore.getState().selectedAccountId).toBe("reader-acc");
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAccountId).toBeNull();
    expect(useUiStore.getState().settingsAddAccount).toBe(false);
    expect(useUiStore.getState().settingsAddAccountInitialKind).toBeNull();
  });

  it("blocks user-facing settings navigation actions while account setup is locked", () => {
    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: "acc-setup",
      settingsAddAccount: false,
      accountSetupSession: {
        accountId: "acc-setup",
        owner: "account-detail",
        state: "syncing",
      },
    });

    useUiStore.getState().closeSettings();
    useUiStore.getState().setSettingsCategory("reading");
    useUiStore.getState().openSettingsAccount("acc-other");
    useUiStore.getState().openSettingsAddAccount("FreshRss");
    useUiStore.getState().setSettingsAccountId("acc-other");
    useUiStore.getState().setSettingsAddAccount(true);

    expect(getSettingsStateSnapshot(useUiStore.getState())).toEqual({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: "acc-setup",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: false,
    });

    useUiStore.getState().setSettingsAccountsView("acc-setup", false);
    expect(useUiStore.getState().settingsAccountId).toBe("acc-setup");
  });

  it("replaces the previous toast dismiss timer when showing another transient toast", () => {
    vi.useFakeTimers();

    useUiStore.getState().showToast("First");
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS - 1);

    useUiStore.getState().showToast("Second");
    vi.advanceTimersByTime(1);

    expect(useUiStore.getState().toastMessage).toEqual({ message: "Second" });

    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS - 2);
    expect(useUiStore.getState().toastMessage).toEqual({ message: "Second" });

    vi.advanceTimersByTime(1);
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("queues toast live-region announcements independently from the visible toast", () => {
    useUiStore.getState().showToast({ message: "Downloading", persistent: true });
    useUiStore.getState().showToast("Saved");

    expect(useUiStore.getState().toastMessage).toEqual({ message: "Saved" });
    expect(useUiStore.getState().toastAnnouncements.map((announcement) => announcement.message)).toEqual([
      "Downloading",
      "Saved",
    ]);

    useUiStore.getState().clearToast();

    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(useUiStore.getState().toastAnnouncements.map((announcement) => announcement.message)).toEqual([
      "Downloading",
      "Saved",
    ]);
  });

  it("suppresses duplicate adjacent toast announcements", () => {
    useUiStore.getState().showToast("Saved");
    useUiStore.getState().showToast("Saved");
    useUiStore.getState().showToast("Copied");

    expect(useUiStore.getState().toastAnnouncements.map((announcement) => announcement.message)).toEqual([
      "Saved",
      "Copied",
    ]);
  });

  it("does not schedule dismiss timers for persistent toasts", () => {
    vi.useFakeTimers();

    useUiStore.getState().showToast({ message: "Downloading", persistent: true });
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS * 2);

    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Downloading",
      persistent: true,
    });
  });

  it("clears pending toast dismiss timers when manually clearing a toast", () => {
    vi.useFakeTimers();

    useUiStore.getState().showToast("Temporary");
    useUiStore.getState().clearToast();
    useUiStore.getState().showToast({ message: "Persistent", persistent: true });
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS);

    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Persistent",
      persistent: true,
    });
  });

  it("clears pending toast dismiss timers when resetting the store state", () => {
    vi.useFakeTimers();

    useUiStore.getState().showToast("Temporary");
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().showToast({ message: "Persistent", persistent: true });
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS);

    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Persistent",
      persistent: true,
    });
  });

  it("does not let a stale transient toast timer clear a later update toast", () => {
    vi.useFakeTimers();

    useUiStore.getState().showToast("Temporary");
    useUiStore.setState((state) => ({
      ...state,
      toastMessage: null,
    }));
    useUiStore.getState().showToast({
      message: "Update ready",
      persistent: true,
      variant: "update",
      actions: [
        {
          label: "Restart",
          onClick: () => {
            useUiStore.getState().showToast("Restarting");
          },
        },
      ],
    });

    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS);

    expect(useUiStore.getState().toastMessage).toEqual(
      expect.objectContaining({
        message: "Update ready",
        persistent: true,
        variant: "update",
        actions: [
          {
            label: "Restart",
            onClick: expect.any(Function),
          },
        ],
      }),
    );
  });

  it("keeps dialog action toasts from being cleared by older toast dismiss timers", () => {
    vi.useFakeTimers();
    const dialogToastAction = vi.fn(() => {
      useUiStore.getState().showToast({
        message: "Delete failed",
        persistent: true,
      });
    });

    useUiStore.getState().showToast({
      message: "Delete feed?",
      actions: [
        {
          label: "Undo",
          onClick: dialogToastAction,
        },
      ],
    });
    const action = useUiStore.getState().toastMessage?.actions?.[0];
    action?.onClick();

    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS);

    expect(dialogToastAction).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Delete failed",
      persistent: true,
    });
  });

  it("replaces confirm dialog content and callbacks completely", () => {
    const FirstIcon = () => null;
    const SecondIcon = () => null;
    const firstConfirm = vi.fn();
    const secondConfirm = vi.fn();

    useUiStore.getState().showConfirm("Delete feed?", firstConfirm, {
      actionLabel: "Delete",
      variant: "destructive",
      icon: FirstIcon,
    });
    useUiStore.getState().showConfirm("Archive feed?", secondConfirm, {
      actionLabel: "Archive",
      variant: "default",
      icon: SecondIcon,
    });

    expect(useUiStore.getState().confirmDialog).toEqual({
      open: true,
      message: "Archive feed?",
      actionLabel: "Archive",
      actionAccessibleLabel: null,
      variant: "default",
      icon: SecondIcon,
      onConfirm: secondConfirm,
    });
  });

  it("clears optional confirm dialog fields when replacement omits them", () => {
    const FirstIcon = () => null;
    const firstConfirm = vi.fn();
    const secondConfirm = vi.fn();

    useUiStore.getState().showConfirm("Delete feed?", firstConfirm, {
      actionLabel: "Delete",
      variant: "destructive",
      icon: FirstIcon,
    });
    useUiStore.getState().showConfirm("Continue?", secondConfirm);

    expect(useUiStore.getState().confirmDialog).toEqual({
      open: true,
      message: "Continue?",
      actionLabel: null,
      actionAccessibleLabel: null,
      variant: "default",
      icon: null,
      onConfirm: secondConfirm,
    });
  });

  it("closes confirm dialog without retaining stale callback or icon", () => {
    const Icon = () => null;
    const onConfirm = vi.fn();

    useUiStore.getState().showConfirm("Delete feed?", onConfirm, {
      actionLabel: "Delete",
      variant: "destructive",
      icon: Icon,
    });
    useUiStore.getState().closeConfirm();

    expect(useUiStore.getState().confirmDialog).toEqual({
      open: false,
      message: "",
      actionLabel: null,
      actionAccessibleLabel: null,
      variant: "default",
      icon: null,
      onConfirm: null,
    });
  });
});
