import type { StoreApi } from "zustand";
import { getPreferredAccountId } from "@/lib/account/account-selection";
import {
  addRetainedArticle,
  addRetainedArticles,
  getRetainedArticleIdsAfterSelectingArticle,
} from "@/lib/articles/article-retention";
import type { FocusedPane } from "@/lib/layout/layout-state.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { SubscriptionsWorkspaceReturnState } from "@/schemas/subscriptions-workspace";
import type { UiState, UiStoreReaderActions, UiStoreReaderSelection, UiStoreState } from "@/stores/ui-store.types";
import { getSettingsAccountsViewState } from "@/stores/ui-store-settings-actions";
import { getIdleSyncProgress } from "@/stores/ui-store-sync-actions";

type UiStoreSet = StoreApi<UiStoreState>["setState"];
type UiStoreReaderSliceActions = UiStoreReaderActions & Pick<UiStoreState, "setHasNextArticle">;
type UiStoreReaderRuntime = {
  parseSubscriptionsWorkspaceReturnState: (value: unknown) => SubscriptionsWorkspaceReturnState;
};

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

export function createUiStoreReaderActions(set: UiStoreSet, runtime: UiStoreReaderRuntime): UiStoreReaderSliceActions {
  return {
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
      set((state) =>
        getReaderScopeResetState({ type: "tag", tagId }, { viewMode: getContextAwareScopeViewMode(state) }),
      ),
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
    closeBrowser: () => set((state) => getClosedBrowserReaderState(state)),
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
      set((state) => {
        const next = new Set(state.expandedFolderIds);
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
              returnState: runtime.parseSubscriptionsWorkspaceReturnState(returnState),
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
    addRecentlyRead: (id) =>
      set((state) => {
        const next = new Set(state.recentlyReadIds);
        next.add(id);
        return { recentlyReadIds: next };
      }),
    removeRecentlyRead: (id) =>
      set((state) => {
        if (!state.recentlyReadIds.has(id)) {
          return state;
        }

        const next = new Set(state.recentlyReadIds);
        next.delete(id);
        return { recentlyReadIds: next };
      }),
    clearRecentlyRead: () => set({ recentlyReadIds: new Set() }),
    retainArticle: (id) =>
      set((state) => ({
        retainedArticleIds: addRetainedArticle(state.retainedArticleIds, id),
      })),
    retainArticles: (ids) =>
      set((state) => ({
        retainedArticleIds: addRetainedArticles(state.retainedArticleIds, ids),
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
  };
}
