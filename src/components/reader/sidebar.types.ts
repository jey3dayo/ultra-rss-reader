import type { TFunction } from "i18next";
import type { SidebarAccountSectionProps } from "./sidebar-account-section";
import type { SidebarContentSectionsProps } from "./sidebar-content-sections";
import type { SidebarSelection } from "./sidebar-feed-tree.types";
import type { SidebarHeaderViewProps } from "./sidebar-header-view";
import type { SmartViewsViewProps } from "./smart-views-view";

export type SidebarHeaderProps = SidebarHeaderViewProps;
export type SidebarAccountProps = SidebarAccountSectionProps;
export type SidebarContentProps = SidebarContentSectionsProps;

export type SidebarSectionPropsResult = {
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountProps;
  smartViewsProps: SmartViewsViewProps;
  contentSectionsProps: SidebarContentProps;
};

export type SidebarViewPropsResult = SidebarSectionPropsResult & {
  sidebarClassName: string;
};

export type SidebarControllerResult = SidebarViewPropsResult;

export type SidebarHeaderPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: {
    active: boolean;
    kind: string | null;
  };
  handleSync: () => void | Promise<void>;
  handleAddFeed: () => void;
};

export type SidebarSmartViewsParams = {
  selection: SidebarSelection;
  totalUnread: number;
  starredCount: number;
  showUnreadCount: boolean;
  showStarredCount: boolean;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  t: TFunction<"sidebar">;
};

export type SidebarSmartViewsResult = SmartViewsViewProps["views"];

export type SidebarSmartViewsPropsParams = {
  t: TFunction<"sidebar">;
  visibleSmartViews: SidebarSmartViewsResult;
  selectSmartView: SmartViewsViewProps["onSelectSmartView"];
};

export type SidebarSectionPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: SidebarHeaderPropsParams["syncProgress"];
  handleSync: SidebarHeaderPropsParams["handleSync"];
  handleAddFeed: SidebarHeaderPropsParams["handleAddFeed"];
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
  visibleSmartViews: SidebarSmartViewsResult;
  selectSmartView: SmartViewsViewProps["onSelectSmartView"];
  isFeedsSectionOpen: boolean;
  toggleFeedsSection: () => void;
  feedViewportRef: import("react").RefObject<HTMLDivElement | null>;
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
