import type { TFunction } from "i18next";
import type { SidebarContentSections } from "./sidebar-content-sections";

type SidebarContentSectionsProps = Parameters<typeof SidebarContentSections>[0];

type UseSidebarContentSectionsPropsParams = {
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
};

export function useSidebarContentSectionsProps({
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
}: UseSidebarContentSectionsPropsParams): SidebarContentSectionsProps {
  return {
    subscriptionsLabel: t("subscriptions"),
    isFeedsSectionOpen,
    onToggleFeedsSection: toggleFeedsSection,
    viewportRef: feedViewportRef,
    feedCleanupLabel: t("feed_cleanup"),
    settingsLabel: t("settings"),
    onOpenFeedCleanup: openFeedCleanup,
    onOpenSettings: handleOpenSettings,
    selectedAccountId,
    isAddFeedDialogOpen,
    onAddFeedDialogOpenChange: handleAddFeedDialogOpenChange,
    addAccountToStartLabel: t("add_account_to_start"),
    pressPlusToAddFeedLabel: t("press_plus_to_add_feed"),
    tagsLabel: t("tags"),
    noFolderLabel: t("no_folder"),
    showSidebarTags,
    isTagsSectionOpen,
    onToggleTagsSection: toggleTagsSection,
    onOpenAccountSettings: handleOpenAccountSettings,
    feedTreeProps,
    tags,
    tagArticleCounts,
    selection,
    onSelectTag: selectTag,
    renderTagContextMenu,
  };
}
