import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSidebarTagItems } from "@/components/reader/hooks/sidebar/use-sidebar-tag-items";
import { AddFeedDialog } from "./add-feed-dialog";
import type { FeedTreeEmptyState } from "./feed-tree.types";
import { FeedTreeView } from "./feed-tree-view";
import type { SidebarContentSectionsProps } from "./sidebar.types";
import { SidebarContentView } from "./sidebar-content-view";
import { SidebarFeedTreeSkeleton } from "./sidebar-feed-tree-skeleton";
import { SidebarTagSection } from "./sidebar-tag-section";

export function SidebarContentSections({
  subscriptionsLabel,
  isFeedsSectionOpen,
  onToggleFeedsSection,
  renderSubscriptionsSectionContextMenu,
  viewportRef,
  subscriptionsIndexLabel,
  subscriptionsIndexShortLabel,
  settingsLabel,
  themeToggleLabel,
  onOpenSubscriptionsIndex,
  onOpenSettings,
  selectedAccountId,
  isAddFeedDialogOpen,
  onAddFeedDialogOpenChange,
  pressPlusToAddFeedLabel,
  tagsLabel,
  noFolderLabel,
  showSidebarTags,
  isTagsSectionOpen,
  onToggleTagsSection,
  feedTreeProps,
  tags,
  tagArticleCounts,
  selection,
  onSelectTag,
  renderTagContextMenu,
  renderTagSectionContextMenu,
  sidebarDensity,
  isFeedTreeLoading,
  showFeedTreeSkeleton,
  onFocusAccountList,
}: SidebarContentSectionsProps) {
  const { t: commonT } = useTranslation("common");
  const tagItems = useSidebarTagItems({ tags, tagArticleCounts, selection });
  const feedEmptyState: FeedTreeEmptyState = selectedAccountId
    ? isFeedTreeLoading
      ? { kind: "loading", label: commonT("loading") }
      : { kind: "message", message: pressPlusToAddFeedLabel }
    : { kind: "hidden" };

  const tagSection = showSidebarTags ? (
    <SidebarTagSection
      tagsLabel={tagsLabel}
      isOpen={isTagsSectionOpen}
      onToggleOpen={onToggleTagsSection}
      sidebarDensity={sidebarDensity}
      tags={tagItems}
      onSelectTag={onSelectTag}
      renderTagSectionContextMenu={renderTagSectionContextMenu}
      renderContextMenu={renderTagContextMenu}
    />
  ) : null;

  const addFeedDialog = selectedAccountId ? (
    <AddFeedDialog open={isAddFeedDialogOpen} onOpenChange={onAddFeedDialogOpenChange} accountId={selectedAccountId} />
  ) : null;
  const subscriptionsSectionContextMenu = useMemo(
    () => renderSubscriptionsSectionContextMenu(),
    [renderSubscriptionsSectionContextMenu],
  );

  return (
    <SidebarContentView
      subscriptionsLabel={subscriptionsLabel}
      isFeedsSectionOpen={isFeedsSectionOpen}
      onToggleFeedsSection={onToggleFeedsSection}
      subscriptionsSectionContextMenu={subscriptionsSectionContextMenu}
      viewportRef={viewportRef}
      feedTree={
        showFeedTreeSkeleton ? (
          <SidebarFeedTreeSkeleton label={commonT("loading")} />
        ) : (
          <FeedTreeView
            {...feedTreeProps}
            sidebarDensity={sidebarDensity}
            unfolderedLabel={noFolderLabel}
            emptyState={feedEmptyState}
          />
        )
      }
      tagSection={tagSection}
      subscriptionsIndexLabel={subscriptionsIndexLabel}
      subscriptionsIndexShortLabel={subscriptionsIndexShortLabel}
      settingsLabel={settingsLabel}
      themeToggleLabel={themeToggleLabel}
      onOpenSubscriptionsIndex={onOpenSubscriptionsIndex}
      onOpenSettings={onOpenSettings}
      onFocusAccountList={onFocusAccountList}
      addFeedDialog={addFeedDialog}
    />
  );
}
