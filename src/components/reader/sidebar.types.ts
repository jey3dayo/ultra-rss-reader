import type { TFunction } from "i18next";
import type { ComponentPropsWithoutRef, ReactNode, RefObject } from "react";
import type { SortSubscriptions } from "@/stores/preferences-store";
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
  syncButtonText: string;
  addFeedButtonLabel: string;
  addFeedButtonText: string;
  isSyncDisabled?: boolean;
  isAddFeedDisabled?: boolean;
};

export type SidebarNavButtonProps = ComponentPropsWithoutRef<"button"> & {
  children?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
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
  feedCleanupLabel: string;
  settingsLabel: string;
  onOpenFeedCleanup: () => void;
  onOpenSettings: () => void;
  selectedAccountId: string | null;
  isAddFeedDialogOpen: boolean;
  onAddFeedDialogOpenChange: (open: boolean) => void;
  addAccountToStartLabel: string;
  pressPlusToAddFeedLabel: string;
  tagsLabel: string;
  noFolderLabel: string;
  showSidebarTags: boolean;
  isTagsSectionOpen: SidebarTagListProps["isOpen"];
  onToggleTagsSection: SidebarTagListProps["onToggleOpen"];
  onOpenAccountSettings: () => void;
  feedTreeProps: SidebarFeedTreeProps;
  tags: SidebarTagItemsParams["tags"];
  tagArticleCounts: SidebarTagItemsParams["tagArticleCounts"];
  selection: SidebarTagItemsParams["selection"];
  onSelectTag: SidebarTagListProps["onSelectTag"];
  renderTagContextMenu: NonNullable<SidebarTagListProps["renderContextMenu"]>;
  renderTagSectionContextMenu: NonNullable<SidebarTagListProps["renderTagSectionContextMenu"]>;
  sidebarDensity: SidebarDensity;
  isFeedTreeLoading: boolean;
};

export type SidebarContentProps = SidebarContentSectionsProps;

export type SmartViewKind = "unread" | "starred";

export type SmartViewItemViewModel = {
  kind: SmartViewKind;
  label: string;
  count: number;
  showCount: boolean;
  isSelected: boolean;
};

export type SidebarSmartViewsProps = {
  title?: string;
  views: SmartViewItemViewModel[];
  onSelectSmartView: (kind: SmartViewKind) => void;
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
  isFeedTreeLoading: import("./sidebar-sources.types").SidebarSourcesResult["isFeedTreeLoading"];
  selection: SidebarSelection;
  viewMode: import("./sidebar-feed-tree.types").SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: SortSubscriptions;
  grayscaleFavicons: boolean;
  isFeedsSectionOpen: boolean;
  startupFolderExpansion: import("./sidebar-feed-section.types").StartupFolderExpansionMode;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarTags: boolean;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  selectFeed: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectAll: () => void;
  selectSmartView: SidebarSmartViewsProps["onSelectSmartView"];
  selectTag: SidebarContentSectionsProps["onSelectTag"];
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
  syncProgress: SidebarHeaderPropsParams["syncProgress"];
  handleSync: SidebarHeaderPropsParams["handleSync"];
  handleAddFeed: SidebarHeaderPropsParams["handleAddFeed"];
  toggleFeedsSection: () => void;
  lastSyncedLabel: string;
  totalUnread: number;
  starredCount: number;
  showUnreadCount: boolean;
  showStarredCount: boolean;
  feedViewportRef: SidebarContentSectionsProps["viewportRef"];
  openFeedCleanup: () => void;
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

export type SidebarSmartViewsResult = SidebarSmartViewsProps["views"];

export type SidebarSmartViewsPropsParams = {
  t: TFunction<"sidebar">;
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
};

export type SidebarContentSectionsPropsParams = {
  t: TFunction<"sidebar">;
  isFeedsSectionOpen: boolean;
  toggleFeedsSection: () => void;
  feedViewportRef: SidebarContentSectionsProps["viewportRef"];
  openFeedCleanup: () => void;
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
  selectSmartView: SidebarSmartViewsProps["onSelectSmartView"];
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
  renderTagSectionContextMenu: SidebarContentSectionsProps["renderTagSectionContextMenu"];
  sidebarDensity: SidebarDensity;
  isFeedTreeLoading: SidebarContentSectionsProps["isFeedTreeLoading"];
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
};

export type SidebarFooterActionsViewProps = {
  feedCleanupLabel: string;
  settingsLabel: string;
  onOpenFeedCleanup: () => void;
  onOpenSettings: () => void;
};

export type SidebarContentViewProps = {
  subscriptionsLabel: string;
  isFeedsSectionOpen: boolean;
  onToggleFeedsSection: () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
  feedTree: ReactNode;
  tagSection: ReactNode;
  feedCleanupLabel: string;
  settingsLabel: string;
  onOpenFeedCleanup: () => void;
  onOpenSettings: () => void;
  addFeedDialog?: ReactNode;
};

export type SidebarContextMenuRenderersResult = {
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
  renderTagContextMenu: SidebarContentSectionsProps["renderTagContextMenu"];
  renderTagSectionContextMenu: SidebarContentSectionsProps["renderTagSectionContextMenu"];
};
