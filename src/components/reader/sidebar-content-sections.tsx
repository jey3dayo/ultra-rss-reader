import { AddFeedDialog } from "./add-feed-dialog";
import { FeedTreeView } from "./feed-tree-view";
import type { SidebarContentSectionsProps } from "./sidebar.types";
import { SidebarContentView } from "./sidebar-content-view";
import { SidebarTagSection } from "./sidebar-tag-section";
import { useSidebarTagItems } from "./use-sidebar-tag-items";

export function SidebarContentSections({
  subscriptionsLabel,
  isFeedsSectionOpen,
  onToggleFeedsSection,
  viewportRef,
  feedCleanupLabel,
  settingsLabel,
  onOpenFeedCleanup,
  onOpenSettings,
  selectedAccountId,
  isAddFeedDialogOpen,
  onAddFeedDialogOpenChange,
  addAccountToStartLabel,
  pressPlusToAddFeedLabel,
  tagsLabel,
  noFolderLabel,
  showSidebarTags,
  isTagsSectionOpen,
  onToggleTagsSection,
  onOpenAccountSettings,
  feedTreeProps,
  tags,
  tagArticleCounts,
  selection,
  onSelectTag,
  renderTagContextMenu,
}: SidebarContentSectionsProps) {
  const tagItems = useSidebarTagItems({ tags, tagArticleCounts, selection });
  const feedEmptyState = selectedAccountId
    ? { kind: "message" as const, message: pressPlusToAddFeedLabel }
    : {
        kind: "action" as const,
        label: addAccountToStartLabel,
        onAction: onOpenAccountSettings,
      };

  const tagSection = showSidebarTags ? (
    <SidebarTagSection
      tagsLabel={tagsLabel}
      isOpen={isTagsSectionOpen}
      onToggleOpen={onToggleTagsSection}
      tags={tagItems}
      onSelectTag={onSelectTag}
      renderContextMenu={renderTagContextMenu}
    />
  ) : null;

  const addFeedDialog = selectedAccountId ? (
    <AddFeedDialog open={isAddFeedDialogOpen} onOpenChange={onAddFeedDialogOpenChange} accountId={selectedAccountId} />
  ) : null;

  return (
    <SidebarContentView
      subscriptionsLabel={subscriptionsLabel}
      isFeedsSectionOpen={isFeedsSectionOpen}
      onToggleFeedsSection={onToggleFeedsSection}
      viewportRef={viewportRef}
      feedTree={<FeedTreeView {...feedTreeProps} unfolderedLabel={noFolderLabel} emptyState={feedEmptyState} />}
      tagSection={tagSection}
      feedCleanupLabel={feedCleanupLabel}
      settingsLabel={settingsLabel}
      onOpenFeedCleanup={onOpenFeedCleanup}
      onOpenSettings={onOpenSettings}
      addFeedDialog={addFeedDialog}
    />
  );
}
