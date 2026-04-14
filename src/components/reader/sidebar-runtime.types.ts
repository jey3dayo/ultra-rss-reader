import type { Dispatch, RefObject, SetStateAction } from "react";
import type { DevIntent } from "@/lib/dev-intent";
import type { SortSubscriptions } from "@/stores/preferences-store";
import type { UiStoreState } from "@/stores/ui-store";
import type { SidebarSourcesResult } from "./sidebar-sources.types";
import type { SidebarSyncResult } from "./sidebar-sync.types";

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
  | "selectedAccountId"
  | "selectAccount"
  | "restoreAccountSelection"
  | "clearSelectedAccount"
  | "selection"
  | "viewMode"
  | "selectFeed"
  | "selectFolder"
  | "selectAll"
  | "selectSmartView"
  | "selectTag"
  | "setViewMode"
  | "expandedFolderIds"
  | "setExpandedFolders"
  | "toggleFolder"
  | "openSettings"
  | "openFeedCleanup"
  | "isAddFeedDialogOpen"
  | "openAddFeedDialog"
  | "closeAddFeedDialog"
  | "setSettingsAddAccount"
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
  showSidebarTags: boolean;
  displayFavicons: boolean;
  grayscaleFavicons: boolean;
  sortSubscriptions: SortSubscriptions;
  startupFolderExpansion: "all_collapsed" | "restore_previous" | "unread_folders";
  opaqueSidebars: boolean;
  savedAccountId: string;
  setPref: (key: string, value: string) => void;
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
