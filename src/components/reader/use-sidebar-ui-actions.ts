import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { SettingsCategory } from "@/stores/ui-store";

type UseSidebarUiActionsParams = {
  selectedAccountId: string | null;
  selectAccount: (accountId: string) => void;
  setSelectedAccountPreference: (accountId: string) => void;
  openSettings: (category?: SettingsCategory) => void;
  setSettingsAddAccount: (open: boolean) => void;
  openAddFeedDialog: () => void;
  closeAddFeedDialog: () => void;
  setIsFeedsSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsTagsSectionOpen: Dispatch<SetStateAction<boolean>>;
};

export function useSidebarUiActions({
  selectedAccountId,
  selectAccount,
  setSelectedAccountPreference,
  openSettings,
  setSettingsAddAccount,
  openAddFeedDialog,
  closeAddFeedDialog,
  setIsFeedsSectionOpen,
  setIsTagsSectionOpen,
}: UseSidebarUiActionsParams) {
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

  const handleOpenAccountSettings = useCallback(() => {
    openSettings("accounts");
    setSettingsAddAccount(true);
  }, [openSettings, setSettingsAddAccount]);

  const handleAddFeed = useCallback(() => {
    if (selectedAccountId) {
      openAddFeedDialog();
      return;
    }

    handleOpenAccountSettings();
  }, [handleOpenAccountSettings, openAddFeedDialog, selectedAccountId]);

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
    handleOpenSettings,
    handleOpenAccountSettings,
    handleAddFeed,
    handleAddFeedDialogOpenChange,
  };
}
