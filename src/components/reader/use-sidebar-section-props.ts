import type { SidebarSectionPropsParams, SidebarSectionPropsResult } from "./sidebar.types";
import { useSidebarAccountSectionProps } from "./use-sidebar-account-section-props";
import { useSidebarContentSectionsProps } from "./use-sidebar-content-sections-props";
import { useSidebarHeaderProps } from "./use-sidebar-header-props";
import { useSidebarSmartViewsProps } from "./use-sidebar-smart-views-props";

export function useSidebarSectionProps({
  t,
  syncProgress,
  handleSync,
  handleAddFeed,
  selectedAccountName,
  lastSyncedLabel,
  accounts,
  accountStatusLabels,
  selectedAccountId,
  isAccountListOpen,
  accountMenuId,
  accountDropdownRef,
  accountTriggerRef,
  accountItemRefs,
  toggleAccountList,
  handleSelectAccount,
  closeAccountList,
  visibleSmartViews,
  selectSmartView,
  isFeedsSectionOpen,
  toggleFeedsSection,
  feedViewportRef,
  openFeedCleanup,
  handleOpenSettings,
  isAddFeedDialogOpen,
  handleAddFeedDialogOpenChange,
  showSidebarTags,
  isTagsSectionOpen,
  toggleTagsSection,
  handleOpenAccountSettings,
  feedTreeProps,
  tags,
  tagArticleCounts,
  selection,
  selectTag,
  renderTagContextMenu,
}: SidebarSectionPropsParams): SidebarSectionPropsResult {
  const headerProps = useSidebarHeaderProps({
    t,
    syncProgress,
    handleSync,
    handleAddFeed,
  });
  const accountSectionProps = useSidebarAccountSectionProps({
    t,
    selectedAccountName,
    lastSyncedLabel,
    accounts,
    accountStatusLabels,
    selectedAccountId,
    isAccountListOpen,
    accountMenuId,
    accountDropdownRef,
    accountTriggerRef,
    accountItemRefs,
    toggleAccountList,
    handleSelectAccount,
    closeAccountList,
  });
  const contentSectionsProps = useSidebarContentSectionsProps({
    t,
    isFeedsSectionOpen,
    toggleFeedsSection,
    feedViewportRef,
    openFeedCleanup,
    handleOpenSettings,
    selectedAccountId,
    isAddFeedDialogOpen,
    handleAddFeedDialogOpenChange,
    showSidebarTags,
    isTagsSectionOpen,
    toggleTagsSection,
    handleOpenAccountSettings,
    feedTreeProps,
    tags,
    tagArticleCounts,
    selection,
    selectTag,
    renderTagContextMenu,
  });
  const smartViewsProps = useSidebarSmartViewsProps({
    t,
    visibleSmartViews,
    selectSmartView,
  });

  return {
    headerProps,
    accountSectionProps,
    smartViewsProps,
    contentSectionsProps,
  };
}
