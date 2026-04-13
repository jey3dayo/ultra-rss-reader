import type { TFunction } from "i18next";
import type { RefObject } from "react";
import type { SidebarAccountSection } from "./sidebar-account-section";
import type { SidebarContentSections } from "./sidebar-content-sections";
import type { SidebarHeaderView } from "./sidebar-header-view";
import type { SmartViewsViewProps } from "./smart-views-view";
import { useSidebarAccountSectionProps } from "./use-sidebar-account-section-props";
import { useSidebarContentSectionsProps } from "./use-sidebar-content-sections-props";

type SidebarHeaderProps = Parameters<typeof SidebarHeaderView>[0];
type SidebarAccountSectionProps = Parameters<typeof SidebarAccountSection>[0];
type SidebarContentSectionsProps = Parameters<typeof SidebarContentSections>[0];

type UseSidebarSectionPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: {
    active: boolean;
    kind: string | null;
  };
  handleSync: () => void | Promise<void>;
  handleAddFeed: () => void;
  selectedAccountName?: string;
  lastSyncedLabel: string;
  accounts: SidebarAccountSectionProps["accounts"];
  accountStatusLabels: SidebarAccountSectionProps["accountStatusLabels"];
  selectedAccountId: SidebarAccountSectionProps["selectedAccountId"];
  isAccountListOpen: boolean;
  accountMenuId: string;
  accountDropdownRef: SidebarAccountSectionProps["containerRef"];
  accountTriggerRef: SidebarAccountSectionProps["triggerRef"];
  accountItemRefs: SidebarAccountSectionProps["itemRefs"];
  toggleAccountList: () => void;
  handleSelectAccount: SidebarAccountSectionProps["onSelectAccount"];
  closeAccountList: () => void;
  visibleSmartViews: SmartViewsViewProps["views"];
  selectSmartView: SmartViewsViewProps["onSelectSmartView"];
  isFeedsSectionOpen: boolean;
  toggleFeedsSection: () => void;
  feedViewportRef: RefObject<HTMLDivElement | null>;
  openFeedCleanup: () => void;
  handleOpenSettings: () => void;
  isAddFeedDialogOpen: boolean;
  handleAddFeedDialogOpenChange: (open: boolean) => void;
  showSidebarTags: boolean;
  isTagsSectionOpen: boolean;
  toggleTagsSection: () => void;
  handleOpenAccountSettings: () => void;
  feedTreeProps: SidebarContentSectionsProps["feedTreeProps"];
  tags: SidebarContentSectionsProps["tags"];
  tagArticleCounts: SidebarContentSectionsProps["tagArticleCounts"];
  selection: SidebarContentSectionsProps["selection"];
  selectTag: SidebarContentSectionsProps["onSelectTag"];
  renderTagContextMenu: SidebarContentSectionsProps["renderTagContextMenu"];
};

type UseSidebarSectionPropsResult = {
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountSectionProps;
  smartViewsProps: SmartViewsViewProps;
  contentSectionsProps: SidebarContentSectionsProps;
};

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
}: UseSidebarSectionPropsParams): UseSidebarSectionPropsResult {
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

  return {
    headerProps: {
      isSyncing: syncProgress.active && syncProgress.kind !== "manual_account",
      onSync: handleSync,
      onAddFeed: handleAddFeed,
      syncButtonLabel: t("sync_feeds"),
      addFeedButtonLabel: t("add_feed"),
    },
    accountSectionProps,
    smartViewsProps: {
      title: t("smart_views"),
      views: visibleSmartViews,
      onSelectSmartView: selectSmartView,
    },
    contentSectionsProps,
  };
}
