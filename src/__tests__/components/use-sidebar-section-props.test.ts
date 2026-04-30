import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SmartViewItemViewModel } from "@/components/reader/sidebar.types";
import { useSidebarAccountSectionProps } from "@/components/reader/use-sidebar-account-section-props";
import { useSidebarContentSectionsProps } from "@/components/reader/use-sidebar-content-sections-props";
import { useSidebarSmartViewsProps } from "@/components/reader/use-sidebar-smart-views-props";
import i18n from "@/lib/i18n";
import type { UiSelection } from "@/stores/ui-store";

const t = i18n.getFixedT("en", "sidebar");

describe("sidebar section props builders", () => {
  it("maps account switcher labels, refs, and handlers", () => {
    const containerRef = createRef<HTMLDivElement>();
    const triggerRef = createRef<HTMLButtonElement>();
    const itemRefs: RefObject<Array<HTMLButtonElement | null>> = { current: [] };
    const onToggle = vi.fn();
    const onSelectAccount = vi.fn();
    const onClose = vi.fn();

    const props = useSidebarAccountSectionProps({
      t,
      selectedAccountName: "Work",
      lastSyncedLabel: "Synced now",
      accounts: [],
      accountStatusLabels: { account_1: "Syncing" },
      selectedAccountId: "account_1",
      isAccountListOpen: true,
      accountMenuId: "account-menu",
      accountDropdownRef: containerRef,
      accountTriggerRef: triggerRef,
      accountItemRefs: itemRefs,
      toggleAccountList: onToggle,
      handleSelectAccount: onSelectAccount,
      closeAccountList: onClose,
    });

    expect(props).toEqual({
      containerRef,
      title: "Work",
      lastSyncedLabel: "Synced now",
      accounts: [],
      accountStatusLabels: { account_1: "Syncing" },
      selectedAccountId: "account_1",
      isExpanded: true,
      menuId: "account-menu",
      menuLabel: t("accounts"),
      triggerRef,
      itemRefs,
      onToggle,
      onSelectAccount,
      onClose,
    });
  });

  it("falls back to the app name when no account is selected", () => {
    const props = useSidebarAccountSectionProps({
      t,
      lastSyncedLabel: "",
      accounts: [],
      accountStatusLabels: undefined,
      selectedAccountId: null,
      isAccountListOpen: false,
      accountMenuId: "account-menu",
      accountDropdownRef: createRef<HTMLDivElement>(),
      accountTriggerRef: createRef<HTMLButtonElement>(),
      accountItemRefs: { current: [] },
      toggleAccountList: vi.fn(),
      handleSelectAccount: vi.fn(),
      closeAccountList: vi.fn(),
    });

    expect(props.title).toBe(t("app_name"));
  });

  it("maps smart views label and selection handler", () => {
    const onSelectSmartView = vi.fn();
    const views: SmartViewItemViewModel[] = [
      { kind: "unread", label: "Unread", count: 2, showCount: true, isSelected: true },
      { kind: "recent", label: "Recent", count: 0, showCount: false, isSelected: false },
    ];

    const props = useSidebarSmartViewsProps({
      t,
      visibleSmartViews: views,
      selectSmartView: onSelectSmartView,
    });

    expect(props).toEqual({
      title: t("smart_views"),
      views,
      onSelectSmartView,
    });
  });

  it("maps content section labels and delegates handlers", () => {
    const viewportRef = createRef<HTMLDivElement>();
    const renderSubscriptionsSectionContextMenu = vi.fn();
    const renderTagSectionContextMenu = vi.fn();
    const renderTagContextMenu = vi.fn();
    const onToggleFeedsSection = vi.fn();
    const onOpenSubscriptionsIndex = vi.fn();
    const onOpenSettings = vi.fn();
    const onAddFeedDialogOpenChange = vi.fn();
    const onToggleTagsSection = vi.fn();
    const onSelectTag = vi.fn();
    const onFocusAccountList = vi.fn();
    const feedTreeProps = {
      isOpen: true,
      folders: [],
      unfolderedFeeds: [],
      onToggleFolder: vi.fn(),
      onSelectFeed: vi.fn(),
      displayFavicons: true,
    };
    const selection: UiSelection = { type: "all" };

    const props = useSidebarContentSectionsProps({
      t,
      isFeedsSectionOpen: true,
      toggleFeedsSection: onToggleFeedsSection,
      renderSubscriptionsSectionContextMenu,
      feedViewportRef: viewportRef,
      openSubscriptionsIndex: onOpenSubscriptionsIndex,
      handleOpenSettings: onOpenSettings,
      selectedAccountId: "account_1",
      isAddFeedDialogOpen: false,
      handleAddFeedDialogOpenChange: onAddFeedDialogOpenChange,
      showSidebarTags: true,
      isTagsSectionOpen: false,
      toggleTagsSection: onToggleTagsSection,
      handleOpenAccountSettings: vi.fn(),
      feedTreeProps,
      tags: [],
      tagArticleCounts: {},
      selection,
      selectTag: onSelectTag,
      renderTagSectionContextMenu,
      renderTagContextMenu,
      sidebarDensity: "compact",
      isFeedTreeLoading: false,
      showFeedTreeSkeleton: false,
      onFocusAccountList,
    });

    expect(props).toEqual({
      subscriptionsLabel: t("subscriptions"),
      isFeedsSectionOpen: true,
      onToggleFeedsSection,
      renderSubscriptionsSectionContextMenu,
      viewportRef,
      subscriptionsIndexLabel: t("subscriptions_index"),
      settingsLabel: t("settings"),
      onOpenSubscriptionsIndex,
      onOpenSettings,
      selectedAccountId: "account_1",
      isAddFeedDialogOpen: false,
      onAddFeedDialogOpenChange,
      pressPlusToAddFeedLabel: t("press_plus_to_add_feed"),
      tagsLabel: t("tags"),
      noFolderLabel: t("no_folder"),
      showSidebarTags: true,
      isTagsSectionOpen: false,
      onToggleTagsSection,
      feedTreeProps,
      tags: [],
      tagArticleCounts: {},
      selection,
      onSelectTag,
      renderTagSectionContextMenu,
      renderTagContextMenu,
      sidebarDensity: "compact",
      isFeedTreeLoading: false,
      showFeedTreeSkeleton: false,
      onFocusAccountList,
    });
  });
});
