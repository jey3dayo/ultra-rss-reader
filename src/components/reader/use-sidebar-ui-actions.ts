import { useCallback } from "react";
import type { SidebarUiActionsParams, SidebarUiActionsResult } from "./sidebar-controller.types";

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

  const handleOpenTagSettings = useCallback(() => {
    openSettings("tags");
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
    handleOpenTagSettings,
    handleOpenAccountSettings,
    handleAddFeed,
    handleAddFeedDialogOpenChange,
  };
}
