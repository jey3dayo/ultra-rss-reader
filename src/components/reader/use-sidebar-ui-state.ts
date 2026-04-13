import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarUiStateResult } from "./sidebar-runtime.types";
import type { StartupFolderExpansionMode } from "./use-sidebar-startup-folder-expansion";

export function useSidebarUiState(): SidebarUiStateResult {
  const layoutMode = useUiStore((s) => s.layoutMode);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectAccount = useUiStore((s) => s.selectAccount);
  const restoreAccountSelection = useUiStore((s) => s.restoreAccountSelection);
  const clearSelectedAccount = useUiStore((s) => s.clearSelectedAccount);
  const selection = useUiStore((s) => s.selection);
  const viewMode = useUiStore((s) => s.viewMode);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const selectFolder = useUiStore((s) => s.selectFolder);
  const selectAll = useUiStore((s) => s.selectAll);
  const selectSmartView = useUiStore((s) => s.selectSmartView);
  const selectTag = useUiStore((s) => s.selectTag);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const expandedFolderIds = useUiStore((s) => s.expandedFolderIds);
  const setExpandedFolders = useUiStore((s) => s.setExpandedFolders);
  const toggleFolder = useUiStore((s) => s.toggleFolder);
  const openSettings = useUiStore((s) => s.openSettings);
  const openFeedCleanup = useUiStore((s) => s.openFeedCleanup);
  const isAddFeedDialogOpen = useUiStore((s) => s.isAddFeedDialogOpen);
  const openAddFeedDialog = useUiStore((s) => s.openAddFeedDialog);
  const closeAddFeedDialog = useUiStore((s) => s.closeAddFeedDialog);
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const showToast = useUiStore((s) => s.showToast);
  const syncProgress = useUiStore((s) => s.syncProgress);
  const applySyncProgress = useUiStore((s) => s.applySyncProgress);
  const clearSyncProgress = useUiStore((s) => s.clearSyncProgress);

  const showUnreadCount = usePreferencesStore((s) => (s.prefs.show_unread_count ?? "true") === "true");
  const showStarredCount = usePreferencesStore((s) => (s.prefs.show_starred_count ?? "true") === "true");
  const showSidebarUnread = usePreferencesStore(
    (s) => resolvePreferenceValue(s.prefs, "show_sidebar_unread") === "true",
  );
  const showSidebarStarred = usePreferencesStore(
    (s) => resolvePreferenceValue(s.prefs, "show_sidebar_starred") === "true",
  );
  const showSidebarTags = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "show_sidebar_tags") === "true");
  const displayFavicons = usePreferencesStore((s) => (s.prefs.display_favicons ?? "true") === "true");
  const grayscaleFavicons = usePreferencesStore((s) => (s.prefs.grayscale_favicons ?? "false") === "true");
  const sortSubscriptions = usePreferencesStore((s) => s.prefs.sort_subscriptions ?? "folders_first");
  const startupFolderExpansion = usePreferencesStore(
    (s) => resolvePreferenceValue(s.prefs, "startup_folder_expansion") as StartupFolderExpansionMode,
  );
  const opaqueSidebars = usePreferencesStore((s) => (s.prefs.opaque_sidebars ?? "false") === "true");
  const savedAccountId = usePreferencesStore((s) => s.prefs.selected_account_id ?? "");
  const setPref = usePreferencesStore((s) => s.setPref);

  return {
    layoutMode,
    selectedAccountId,
    selectAccount,
    restoreAccountSelection,
    clearSelectedAccount,
    selection,
    viewMode,
    selectFeed,
    selectFolder,
    selectAll,
    selectSmartView,
    selectTag,
    setViewMode,
    expandedFolderIds,
    setExpandedFolders,
    toggleFolder,
    openSettings,
    openFeedCleanup,
    isAddFeedDialogOpen,
    openAddFeedDialog,
    closeAddFeedDialog,
    setSettingsAddAccount,
    showToast,
    syncProgress,
    applySyncProgress,
    clearSyncProgress,
    showUnreadCount,
    showStarredCount,
    showSidebarUnread,
    showSidebarStarred,
    showSidebarTags,
    displayFavicons,
    grayscaleFavicons,
    sortSubscriptions,
    startupFolderExpansion,
    opaqueSidebars,
    savedAccountId,
    setPref,
  };
}
