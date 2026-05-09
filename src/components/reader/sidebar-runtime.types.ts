import type { Dispatch, RefObject, SetStateAction } from "react";
import type { DevIntent } from "@/dev/intent";
import type { PreferenceWritableKey, SortSubscriptions, StartupFolderExpansionPreference } from "@/schemas/preferences";
import type { UiStoreState } from "@/stores/ui-store";
import type { SidebarSyncResult } from "./hooks/sidebar/use-sidebar-sync";
import type { SidebarDensity } from "./sidebar-density";
import type { SidebarSourcesResult } from "./sidebar-sources.types";

export type SidebarAccountSwitcherResult = {
  isAccountListOpen: boolean;
  accountDropdownRef: RefObject<HTMLDivElement | null>;
  accountTriggerRef: RefObject<HTMLButtonElement | null>;
  accountItemRefs: RefObject<Array<HTMLButtonElement | null>>;
  accountMenuId: string;
  closeAccountList: (restoreFocus?: boolean) => void;
  toggleAccountList: () => void;
};

export type SidebarUiStateResult = Pick<
  UiStoreState,
  | "layoutMode"
  | "focusedPane"
  | "selectedAccountId"
  | "selectAccount"
  | "restoreAccountSelection"
  | "clearSelectedAccount"
  | "selection"
  | "viewMode"
  | "selectFeed"
  | "selectFeedFromCurrentContext"
  | "selectFolder"
  | "selectFolderFromCurrentContext"
  | "selectAll"
  | "selectSmartView"
  | "selectTag"
  | "selectTagFromCurrentContext"
  | "setViewMode"
  | "expandedFolderIds"
  | "setExpandedFolders"
  | "toggleFolder"
  | "openSettings"
  | "openSubscriptionsIndex"
  | "isAddFeedDialogOpen"
  | "openAddFeedDialog"
  | "closeAddFeedDialog"
  | "openSettingsAccount"
  | "openSettingsAddAccount"
  | "showToast"
  | "syncProgress"
  | "applySyncProgress"
  | "clearSyncProgress"
> & {
  preferencesLoaded: boolean;
  showUnreadCount: boolean;
  showStarredCount: boolean;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarRecentArticles: boolean;
  showSidebarTags: boolean;
  displayFavicons: boolean;
  grayscaleFavicons: boolean;
  sortSubscriptions: SortSubscriptions;
  startupFolderExpansion: StartupFolderExpansionPreference;
  sidebarDensity: SidebarDensity;
  opaqueSidebars: boolean;
  savedAccountId: string;
  setPref: <K extends PreferenceWritableKey>(key: K, value: string) => void;
};

export type SidebarRuntimeResult = SidebarAccountSwitcherResult &
  SidebarUiStateResult &
  SidebarSourcesResult &
  SidebarSyncResult & {
    isFeedsSectionOpen: boolean;
    setIsFeedsSectionOpen: Dispatch<SetStateAction<boolean>>;
    isTagsSectionOpen: boolean;
    setIsTagsSectionOpen: Dispatch<SetStateAction<boolean>>;
    feedViewportRef: RefObject<HTMLDivElement | null>;
    activeDevIntent: DevIntent;
  };

export type SidebarAccountSelectionParams = {
  accounts: SidebarSourcesResult["accounts"];
  preferencesLoaded: SidebarUiStateResult["preferencesLoaded"];
  selectedAccountId: SidebarUiStateResult["selectedAccountId"];
  savedAccountId: SidebarUiStateResult["savedAccountId"];
  layoutMode: SidebarUiStateResult["layoutMode"];
  activeDevIntent: DevIntent | null;
  clearSelectedAccount: SidebarUiStateResult["clearSelectedAccount"];
  restoreAccountSelection: SidebarUiStateResult["restoreAccountSelection"];
  setSelectedAccountPreference: (accountId: string) => void;
};
