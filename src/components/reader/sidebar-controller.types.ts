import type { Dispatch, SetStateAction } from "react";
import type { SettingsCategory } from "@/stores/ui-store";

export type SidebarSetSelectedAccountPreference = (accountId: string) => void;

export type SidebarUiActionsParams = {
  selectedAccountId: string | null;
  selectAccount: (accountId: string) => void;
  setSelectedAccountPreference: SidebarSetSelectedAccountPreference;
  openSettings: (category?: SettingsCategory) => void;
  setSettingsAddAccount: (open: boolean) => void;
  openAddFeedDialog: () => void;
  closeAddFeedDialog: () => void;
  setIsFeedsSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsTagsSectionOpen: Dispatch<SetStateAction<boolean>>;
};

export type SidebarUiActionsResult = {
  handleSelectAccount: (accountId: string) => void;
  toggleFeedsSection: () => void;
  toggleTagsSection: () => void;
  handleOpenSettings: () => void;
  handleOpenTagSettings: () => void;
  handleOpenAccountSettings: () => void;
  handleAddFeed: () => void;
  handleAddFeedDialogOpenChange: (open: boolean) => void;
};

export type SidebarUpdateFeedFolderArgs = {
  feedId: string;
  folderId: string | null;
};

export type SidebarUpdateFeedFolder = (variables: SidebarUpdateFeedFolderArgs) => Promise<unknown>;

export type SidebarControllerActionsParams = Omit<SidebarUiActionsParams, "setSelectedAccountPreference"> & {
  setPref: (key: string, value: string) => void;
  updateFeedFolder: SidebarUpdateFeedFolder;
};

export type SidebarControllerActionsResult = SidebarUiActionsResult & {
  setSelectedAccountPreference: SidebarSetSelectedAccountPreference;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
};
