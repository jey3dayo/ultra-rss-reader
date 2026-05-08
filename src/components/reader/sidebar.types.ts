import type { TFunction } from "i18next";
import type { ComponentPropsWithoutRef, ReactNode, RefObject } from "react";
import type { SortSubscriptions } from "@/lib/preferences-schema";
import type { SmartViewItemViewModel, SmartViewKind } from "@/lib/sidebar-smart-views";
import type { AccountSwitcherProps } from "./account-switcher.types";
import type { FeedTreeViewProps } from "./feed-tree.types";
import type { SidebarDensity } from "./sidebar-density";
import type { SidebarFeedTreeProps } from "./sidebar-feed-section.types";
import type { SidebarSelection } from "./sidebar-feed-tree.types";
import type { SidebarTagItemsParams, SidebarTagListProps } from "./sidebar-tag-items.types";

export type SidebarHeaderProps = {
  isSyncing: boolean;
  onSync: () => void;
  onAddFeed: () => void;
  syncButtonLabel: string;
  syncTooltipLabel?: string;
  syncButtonText: string;
  addFeedButtonLabel: string;
  addFeedButtonText: string;
  isSyncDisabled?: boolean;
  isSyncCoolingDown?: boolean;
  isAddFeedDisabled?: boolean;
};

export type SidebarNavButtonProps = ComponentPropsWithoutRef<"button"> & {
  children?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  activePane?: boolean;
  registerSidebarNavigationTarget?: boolean;
  selectedIndicatorMode?: "always" | "hide-on-row-hover" | "hidden";
  selectedIndicatorTone?: "accent" | "neutral";
  size?: "default" | "compact";
  density?: SidebarDensity;
  contentClassName?: string;
  trailingClassName?: string;
};

export type SidebarContentSectionsProps = {
  subscriptionsLabel: string;
  isFeedsSectionOpen: boolean;
  onToggleFeedsSection: () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
  subscriptionsIndexLabel: string;
  subscriptionsIndexShortLabel: string;
  settingsLabel: string;
  themeToggleLabel: string;
  onOpenSubscriptionsIndex: () => void;
  onOpenSettings: () => void;
  selectedAccountId: string | null;
  isAddFeedDialogOpen: boolean;
  onAddFeedDialogOpenChange: (open: boolean) => void;
  pressPlusToAddFeedLabel: string;
  tagsLabel: string;
  noFolderLabel: string;
  showSidebarTags: boolean;
  isTagsSectionOpen: SidebarTagListProps["isOpen"];
  onToggleTagsSection: SidebarTagListProps["onToggleOpen"];
  feedTreeProps: SidebarFeedTreeProps;
  tags: SidebarTagItemsParams["tags"];
  tagArticleCounts: SidebarTagItemsParams["tagArticleCounts"];
  selection: SidebarTagItemsParams["selection"];
  onSelectTag: SidebarTagListProps["onSelectTag"];
  renderTagContextMenu: NonNullable<SidebarTagListProps["renderContextMenu"]>;
  renderTagSectionContextMenu: NonNullable<SidebarTagListProps["renderTagSectionContextMenu"]>;
  renderSubscriptionsSectionContextMenu: () => ReactNode;
  sidebarDensity: SidebarDensity;
  isFeedTreeLoading: boolean;
  showFeedTreeSkeleton: boolean;
  onFocusAccountList: () => void;
};

export type SidebarContentProps = SidebarContentSectionsProps;

export type { SmartViewItemViewModel, SmartViewKind } from "@/lib/sidebar-smart-views";

export type SidebarSmartViewsProps = {
  title?: string;
  views: SmartViewItemViewModel[];
  onSelectSmartView: (kind: SmartViewKind) => void;
  renderContextMenu?: (view: SmartViewItemViewModel) => ReactNode;
};

export type SidebarAccountSectionProps = AccountSwitcherProps & {
  containerRef: RefObject<HTMLDivElement | null>;
};

export type SidebarAccountProps = SidebarAccountSectionProps;

export type SidebarSectionPropsResult = {
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountProps;
  smartViewsProps: SidebarSmartViewsProps;
  contentSectionsProps: SidebarContentProps;
};

export type SidebarViewPropsResult = SidebarSectionPropsResult & {
  sidebarClassName: string;
};

export type SidebarControllerResult = SidebarViewPropsResult;

export type SidebarControllerSectionsParams = {
  t: TFunction<"sidebar">;
  selectedAccountId: string | null;
  feeds: import("./sidebar-sources.types").SidebarSourcesResult["feeds"];
  folders: import("./sidebar-sources.types").SidebarSourcesResult["folders"];
  starredCountByFeedId: import("./sidebar-sources.types").SidebarSourcesResult["starredCountByFeedId"];
  isFeedTreeLoading: import("./sidebar-sources.types").SidebarSourcesResult["isFeedTreeLoading"];
  showFeedTreeSkeleton: import("./sidebar-sources.types").SidebarSourcesResult["showFeedTreeSkeleton"];
  selection: SidebarSelection;
  viewMode: import("./sidebar-feed-tree.types").SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: SortSubscriptions;
  grayscaleFavicons: boolean;
  isFeedsSectionOpen: boolean;
  startupFolderExpansion: import("./sidebar-feed-section.types").StartupFolderExpansionMode;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarRecentArticles: boolean;
  showSidebarTags: boolean;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  selectFeedFromCurrentContext: (feedId: string) => void;
  selectFolderFromCurrentContext: (folderId: string) => void;
  selectAll: () => void;
  selectSmartView: SidebarSmartViewsProps["onSelectSmartView"];
  selectTagFromCurrentContext: SidebarContentSectionsProps["onSelectTag"];
  setViewMode: (mode: import("./sidebar-feed-tree.types").SidebarFeedTreeViewMode) => void;
  toggleFolder: (folderId: string) => void;
  displayFavicons: boolean;
  accounts: import("./sidebar-sources.types").SidebarSourcesResult["accounts"];
  accountStatusLabels: SidebarAccountSectionProps["accountStatusLabels"];
  selectedAccount: import("./sidebar-sources.types").SidebarSourcesResult["selectedAccount"];
  isAccountListOpen: boolean;
  accountMenuId: string;
  accountDropdownRef: SidebarAccountSectionProps["containerRef"];
  accountTriggerRef: SidebarAccountSectionProps["triggerRef"];
  accountItemRefs: SidebarAccountSectionProps["itemRefs"];
  toggleAccountList: () => void;
  handleSelectAccount: SidebarAccountSectionProps["onSelectAccount"];
  closeAccountList: () => void;
  focusAccountList: () => void;
  syncProgress: SidebarHeaderPropsParams["syncProgress"];
  handleSync: SidebarHeaderPropsParams["handleSync"];
  syncTooltipLabel: SidebarHeaderPropsParams["syncTooltipLabel"];
  isSyncCoolingDown: SidebarHeaderPropsParams["isSyncCoolingDown"];
  isSyncDisabled: SidebarHeaderPropsParams["isSyncDisabled"];
  handleAddFeed: SidebarHeaderPropsParams["handleAddFeed"];
  toggleFeedsSection: () => void;
  lastSyncedLabel: string;
  totalUnread: number;
  starredCount: number;
  showUnreadCount: boolean;
  showStarredCount: boolean;
  feedViewportRef: SidebarContentSectionsProps["viewportRef"];
  openSubscriptionsIndex: () => void;
  handleOpenSettings: () => void;
  handleOpenTagSettings: () => void;
  isAddFeedDialogOpen: boolean;
  handleAddFeedDialogOpenChange: (open: boolean) => void;
  isTagsSectionOpen: boolean;
  toggleTagsSection: () => void;
  handleOpenAccountSettings: () => void;
  tags: SidebarContentSectionsProps["tags"];
  tagArticleCounts: SidebarContentSectionsProps["tagArticleCounts"];
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
  sidebarDensity: SidebarDensity;
};

export type SidebarHeaderPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: {
    active: boolean;
    kind: string | null;
  };
  handleSync: () => void | Promise<void>;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
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
  showSidebarRecentArticles: boolean;
  t: TFunction<"sidebar">;
};

export type SidebarSmartViewsResult = SidebarSmartViewsProps["views"];

export type SidebarSmartViewsPropsParams = {
  t: TFunction<"sidebar">;
  selectedAccountId: string | null;
  visibleSmartViews: SidebarSmartViewsResult;
  selectSmartView: SidebarSmartViewsProps["onSelectSmartView"];
};

export type SidebarAccountSectionPropsParams = {
  t: TFunction<"sidebar">;
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
  handleOpenAccountSettings: () => void;
};

export type SidebarContentSectionsPropsParams = {
  t: TFunction<"sidebar">;
  isFeedsSectionOpen: boolean;
  toggleFeedsSection: () => void;
  renderSubscriptionsSectionContextMenu: SidebarContentSectionsProps["renderSubscriptionsSectionContextMenu"];
  feedViewportRef: SidebarContentSectionsProps["viewportRef"];
  openSubscriptionsIndex: () => void;
  handleOpenSettings: () => void;
  selectedAccountId: SidebarContentSectionsProps["selectedAccountId"];
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
  renderTagSectionContextMenu: SidebarContentSectionsProps["renderTagSectionContextMenu"];
  sidebarDensity: SidebarDensity;
  isFeedTreeLoading: SidebarContentSectionsProps["isFeedTreeLoading"];
  showFeedTreeSkeleton: SidebarContentSectionsProps["showFeedTreeSkeleton"];
  onFocusAccountList: SidebarContentSectionsProps["onFocusAccountList"];
};

export type SidebarSectionPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: SidebarHeaderPropsParams["syncProgress"];
  handleSync: SidebarHeaderPropsParams["handleSync"];
  syncTooltipLabel: SidebarHeaderPropsParams["syncTooltipLabel"];
  isSyncCoolingDown: SidebarHeaderPropsParams["isSyncCoolingDown"];
  isSyncDisabled: SidebarHeaderPropsParams["isSyncDisabled"];
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
  focusAccountList: () => void;
  visibleSmartViews: SidebarSmartViewsResult;
  selectSmartView: SidebarSmartViewsProps["onSelectSmartView"];
  isFeedsSectionOpen: boolean;
  toggleFeedsSection: () => void;
  renderSubscriptionsSectionContextMenu: SidebarContentSectionsProps["renderSubscriptionsSectionContextMenu"];
  feedViewportRef: import("react").RefObject<HTMLDivElement | null>;
  openSubscriptionsIndex: () => void;
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
  renderTagSectionContextMenu: SidebarContentSectionsProps["renderTagSectionContextMenu"];
  sidebarDensity: SidebarDensity;
  isFeedTreeLoading: SidebarContentSectionsProps["isFeedTreeLoading"];
  showFeedTreeSkeleton: SidebarContentSectionsProps["showFeedTreeSkeleton"];
};

export type SidebarViewPropsParams = {
  opaqueSidebars: boolean;
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountProps;
  smartViewsProps: SidebarSmartViewsProps;
  contentSectionsProps: SidebarContentProps;
};

export type SidebarFeedSectionViewProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  contextMenu?: ReactNode;
};

export type SidebarFooterActionsViewProps = {
  subscriptionsIndexLabel: string;
  subscriptionsIndexShortLabel: string;
  settingsLabel: string;
  themeToggleLabel: string;
  onOpenSubscriptionsIndex: () => void;
  onOpenSettings: () => void;
};

export type SidebarContentViewProps = {
  subscriptionsLabel: string;
  isFeedsSectionOpen: boolean;
  onToggleFeedsSection: () => void;
  subscriptionsSectionContextMenu?: ReactNode;
  viewportRef: RefObject<HTMLDivElement | null>;
  feedTree: ReactNode;
  tagSection: ReactNode;
  subscriptionsIndexLabel: string;
  subscriptionsIndexShortLabel: string;
  settingsLabel: string;
  themeToggleLabel: string;
  onOpenSubscriptionsIndex: () => void;
  onOpenSettings: () => void;
  addFeedDialog?: ReactNode;
  onFocusAccountList: () => void;
};

export type SidebarContextMenuRenderersResult = {
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
  renderTagContextMenu: SidebarContentSectionsProps["renderTagContextMenu"];
  renderTagSectionContextMenu: SidebarContentSectionsProps["renderTagSectionContextMenu"];
  renderSubscriptionsSectionContextMenu: SidebarContentSectionsProps["renderSubscriptionsSectionContextMenu"];
};
