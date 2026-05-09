import type { TFunction } from "i18next";
import type { RefObject } from "react";
import type { SortSubscriptions } from "@/schemas/preferences";
import type { FeedTreeViewProps } from "./feed-tree.types";
import type { SidebarAccountSectionProps } from "./sidebar-account-section";
import type { SidebarContentSectionsProps } from "./sidebar-content-sections";
import type { SidebarDensity } from "./sidebar-density";
import type { StartupFolderExpansionMode } from "./sidebar-feed-section.types";
import type { SidebarFeedTreeViewMode, SidebarSelection } from "./sidebar-feed-tree.types";
import type { SidebarHeaderProps } from "./sidebar-header-view";
import type { SidebarSourcesResult } from "./sidebar-sources.types";
import type { SidebarSmartViewsProps } from "./smart-views-view";

type SidebarContentProps = SidebarContentSectionsProps;

type SidebarAccountProps = SidebarAccountSectionProps;

type SidebarSourceFeeds = SidebarSourcesResult["feeds"];
type SidebarSourceFolders = SidebarSourcesResult["folders"];
type SidebarSourceStarredCountByFeedId = SidebarSourcesResult["starredCountByFeedId"];
type SidebarSourceIsFeedTreeLoading = SidebarSourcesResult["isFeedTreeLoading"];
type SidebarSourceShowFeedTreeSkeleton = SidebarSourcesResult["showFeedTreeSkeleton"];
type SidebarSourceAccounts = SidebarSourcesResult["accounts"];
type SidebarSourceSelectedAccount = SidebarSourcesResult["selectedAccount"];
type SidebarAccountStatusLabels = SidebarAccountSectionProps["accountStatusLabels"];
type SidebarAccountContainerRef = SidebarAccountSectionProps["containerRef"];
type SidebarAccountTriggerRef = SidebarAccountSectionProps["triggerRef"];
type SidebarAccountItemRefs = SidebarAccountSectionProps["itemRefs"];
type SidebarAccountSelectHandler = SidebarAccountSectionProps["onSelectAccount"];
type SidebarSubscriptionsContextMenuRenderer = SidebarContentSectionsProps["subscriptions"]["renderContextMenu"];
type SidebarFeedTreeSectionProps = SidebarContentSectionsProps["feedTree"]["props"];
type SidebarTagItems = SidebarContentSectionsProps["tagSection"]["tags"];
type SidebarTagArticleCounts = SidebarContentSectionsProps["tagSection"]["tagArticleCounts"];
type SidebarTagSelection = SidebarContentSectionsProps["tagSection"]["selection"];
type SidebarTagSelectHandler = SidebarContentSectionsProps["tagSection"]["onSelectTag"];
type SidebarTagContextMenuRenderer = SidebarContentSectionsProps["tagSection"]["renderContextMenu"];
type SidebarTagSectionContextMenuRenderer = SidebarContentSectionsProps["tagSection"]["renderSectionContextMenu"];
type SidebarSyncProgress = {
  active: boolean;
  kind: string | null;
};
type SidebarSyncHandler = () => void | Promise<void>;
type SidebarHeaderAddFeedHandler = () => void;

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
  feeds: SidebarSourceFeeds;
  folders: SidebarSourceFolders;
  starredCountByFeedId: SidebarSourceStarredCountByFeedId;
  isFeedTreeLoading: SidebarSourceIsFeedTreeLoading;
  showFeedTreeSkeleton: SidebarSourceShowFeedTreeSkeleton;
  selection: SidebarSelection;
  viewMode: SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: SortSubscriptions;
  grayscaleFavicons: boolean;
  isFeedsSectionOpen: boolean;
  startupFolderExpansion: StartupFolderExpansionMode;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarRecentArticles: boolean;
  showSidebarTags: boolean;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  selectFeedFromCurrentContext: (feedId: string) => void;
  selectFolderFromCurrentContext: (folderId: string) => void;
  selectAll: () => void;
  selectSmartView: SidebarSmartViewsProps["onSelectSmartView"];
  selectTagFromCurrentContext: SidebarContentSectionsProps["tagSection"]["onSelectTag"];
  setViewMode: (mode: SidebarFeedTreeViewMode) => void;
  toggleFolder: (folderId: string) => void;
  displayFavicons: boolean;
  accounts: SidebarSourceAccounts;
  accountStatusLabels: SidebarAccountStatusLabels;
  selectedAccount: SidebarSourceSelectedAccount;
  isAccountListOpen: boolean;
  accountMenuId: string;
  accountDropdownRef: SidebarAccountContainerRef;
  accountTriggerRef: SidebarAccountTriggerRef;
  accountItemRefs: SidebarAccountItemRefs;
  toggleAccountList: () => void;
  handleSelectAccount: SidebarAccountSelectHandler;
  closeAccountList: () => void;
  focusAccountList: () => void;
  syncProgress: SidebarSyncProgress;
  handleSync: SidebarSyncHandler;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
  handleAddFeed: SidebarHeaderAddFeedHandler;
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
  tags: SidebarTagItems;
  tagArticleCounts: SidebarTagArticleCounts;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
  sidebarDensity: SidebarDensity;
};

export type SidebarHeaderPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: SidebarSyncProgress;
  handleSync: SidebarSyncHandler;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
  handleAddFeed: SidebarHeaderAddFeedHandler;
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
  accountStatusLabels: SidebarAccountStatusLabels;
  selectedAccountId: SidebarAccountSectionProps["selectedAccountId"];
  isAccountListOpen: boolean;
  accountMenuId: string;
  accountDropdownRef: SidebarAccountContainerRef;
  accountTriggerRef: SidebarAccountTriggerRef;
  accountItemRefs: SidebarAccountItemRefs;
  toggleAccountList: () => void;
  handleSelectAccount: SidebarAccountSelectHandler;
  closeAccountList: () => void;
  handleOpenAccountSettings: () => void;
};

export type SidebarContentSectionsPropsParams = {
  t: TFunction<"sidebar">;
  isFeedsSectionOpen: boolean;
  toggleFeedsSection: () => void;
  renderSubscriptionsSectionContextMenu: SidebarSubscriptionsContextMenuRenderer;
  feedViewportRef: SidebarContentSectionsProps["viewportRef"];
  openSubscriptionsIndex: () => void;
  handleOpenSettings: () => void;
  selectedAccountId: SidebarContentSectionsProps["addFeedDialog"]["accountId"];
  isAddFeedDialogOpen: boolean;
  handleAddFeedDialogOpenChange: (open: boolean) => void;
  showSidebarTags: boolean;
  isTagsSectionOpen: boolean;
  toggleTagsSection: () => void;
  handleOpenAccountSettings: () => void;
  feedTreeProps: SidebarFeedTreeSectionProps;
  tags: SidebarTagItems;
  tagArticleCounts: SidebarTagArticleCounts;
  selection: SidebarTagSelection;
  selectTag: SidebarTagSelectHandler;
  renderTagContextMenu: SidebarTagContextMenuRenderer;
  renderTagSectionContextMenu: SidebarTagSectionContextMenuRenderer;
  sidebarDensity: SidebarDensity;
  isFeedTreeLoading: SidebarContentSectionsProps["feedTree"]["isLoading"];
  showFeedTreeSkeleton: SidebarContentSectionsProps["feedTree"]["showSkeleton"];
  onFocusAccountList: SidebarContentSectionsProps["onFocusAccountList"];
};

export type SidebarSectionPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: SidebarSyncProgress;
  handleSync: SidebarSyncHandler;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
  handleAddFeed: SidebarHeaderAddFeedHandler;
  selectedAccountName?: string;
  lastSyncedLabel: string;
  accounts: SidebarAccountSectionProps["accounts"];
  accountStatusLabels: SidebarAccountStatusLabels;
  selectedAccountId: SidebarAccountSectionProps["selectedAccountId"];
  isAccountListOpen: boolean;
  accountMenuId: string;
  accountDropdownRef: SidebarAccountContainerRef;
  accountTriggerRef: SidebarAccountTriggerRef;
  accountItemRefs: SidebarAccountItemRefs;
  toggleAccountList: () => void;
  handleSelectAccount: SidebarAccountSelectHandler;
  closeAccountList: () => void;
  focusAccountList: () => void;
  visibleSmartViews: SidebarSmartViewsResult;
  selectSmartView: SidebarSmartViewsProps["onSelectSmartView"];
  isFeedsSectionOpen: boolean;
  toggleFeedsSection: () => void;
  renderSubscriptionsSectionContextMenu: SidebarSubscriptionsContextMenuRenderer;
  feedViewportRef: RefObject<HTMLDivElement | null>;
  openSubscriptionsIndex: () => void;
  handleOpenSettings: () => void;
  isAddFeedDialogOpen: boolean;
  handleAddFeedDialogOpenChange: (open: boolean) => void;
  showSidebarTags: boolean;
  isTagsSectionOpen: boolean;
  toggleTagsSection: () => void;
  handleOpenAccountSettings: () => void;
  feedTreeProps: SidebarFeedTreeSectionProps;
  tags: SidebarTagItems;
  tagArticleCounts: SidebarTagArticleCounts;
  selection: SidebarTagSelection;
  selectTag: SidebarTagSelectHandler;
  renderTagContextMenu: SidebarTagContextMenuRenderer;
  renderTagSectionContextMenu: SidebarTagSectionContextMenuRenderer;
  sidebarDensity: SidebarDensity;
  isFeedTreeLoading: SidebarContentSectionsProps["feedTree"]["isLoading"];
  showFeedTreeSkeleton: SidebarContentSectionsProps["feedTree"]["showSkeleton"];
};

export type SidebarViewPropsParams = {
  opaqueSidebars: boolean;
  headerProps: SidebarHeaderProps;
  accountSectionProps: SidebarAccountProps;
  smartViewsProps: SidebarSmartViewsProps;
  contentSectionsProps: SidebarContentProps;
};

export type SidebarContextMenuRenderersResult = {
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
  renderTagContextMenu: SidebarTagContextMenuRenderer;
  renderTagSectionContextMenu: SidebarTagSectionContextMenuRenderer;
  renderSubscriptionsSectionContextMenu: SidebarSubscriptionsContextMenuRenderer;
};
