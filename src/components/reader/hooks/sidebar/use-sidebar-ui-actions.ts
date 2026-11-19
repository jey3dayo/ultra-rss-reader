import { type Dispatch, type SetStateAction, useCallback } from "react";
import { executeAction } from "@/lib/actions";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";

export type SidebarSetSelectedAccountPreference = (accountId: string) => void;

export type SidebarUiActionsParams = {
  selectedAccountId: string | null;
  selectAccount: (accountId: string) => void;
  setSelectedAccountPreference: SidebarSetSelectedAccountPreference;
  openSettings: (category?: SettingsCategory) => void;
  openSubscriptionsIndex: () => void;
  openSettingsAddAccount: () => void;
  openAddFeedDialog: () => void;
  closeAddFeedDialog: () => void;
  setIsFeedsSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsTagsSectionOpen: Dispatch<SetStateAction<boolean>>;
};

export type SidebarUiActionsResult = {
  handleSelectAccount: (accountId: string) => void;
  toggleFeedsSection: () => void;
  toggleTagsSection: () => void;
  handleOpenSubscriptionsIndex: () => void;
  handleOpenSettings: () => void;
  handleOpenTagSettings: () => void;
  handleOpenAccountSettings: () => void;
  handleAddFeed: () => void;
  handleAddFeedDialogOpenChange: (open: boolean) => void;
};

export function useSidebarUiActions({
  selectedAccountId,
  selectAccount,
  setSelectedAccountPreference,
  openSettings,
  openSubscriptionsIndex,
  openSettingsAddAccount,
  openAddFeedDialog,
  closeAddFeedDialog,
  setIsFeedsSectionOpen,
  setIsTagsSectionOpen,
}: SidebarUiActionsParams): SidebarUiActionsResult {
  const handleSelectAccount = useCallback(
    (accountId: string) => {
      selectAccount(accountId);
      setSelectedAccountPreference(accountId);
    },
    [selectAccount, setSelectedAccountPreference],
  );

  const toggleFeedsSection = useCallback(() => {
    setIsFeedsSectionOpen((current) => !current);
  }, [setIsFeedsSectionOpen]);

  const toggleTagsSection = useCallback(() => {
    setIsTagsSectionOpen((current) => !current);
  }, [setIsTagsSectionOpen]);

  const handleOpenSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  const handleOpenSubscriptionsIndex = useCallback(() => {
    openSubscriptionsIndex();
  }, [openSubscriptionsIndex]);

  const handleOpenTagSettings = useCallback(() => {
    openSettings("tags");
  }, [openSettings]);

  const handleOpenAccountSettings = useCallback(() => {
    executeAction("open-current-account-settings");
  }, []);

  const handleAddFeed = useCallback(() => {
    if (selectedAccountId) {
      openAddFeedDialog();
      return;
    }

    openSettingsAddAccount();
  }, [openSettingsAddAccount, openAddFeedDialog, selectedAccountId]);

  const handleAddFeedDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openAddFeedDialog();
      } else {
        closeAddFeedDialog();
      }
    },
    [closeAddFeedDialog, openAddFeedDialog],
  );

  return {
    handleSelectAccount,
    toggleFeedsSection,
    toggleTagsSection,
    handleOpenSubscriptionsIndex,
    handleOpenSettings,
    handleOpenTagSettings,
    handleOpenAccountSettings,
    handleAddFeed,
    handleAddFeedDialogOpenChange,
  };
}
