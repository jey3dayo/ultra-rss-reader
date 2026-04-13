import type { ReactNode, RefObject } from "react";
import { AddFeedDialog } from "./add-feed-dialog";
import { FeedTreeView } from "./feed-tree-view";
import { SidebarContentView } from "./sidebar-content-view";
import type { SidebarFeedTreeProps } from "./sidebar-feed-section.types";
import { SidebarTagSection } from "./sidebar-tag-section";
import { useSidebarTagItems } from "./use-sidebar-tag-items";

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
  isTagsSectionOpen: boolean;
  onToggleTagsSection: () => void;
  onOpenAccountSettings: () => void;
  feedTreeProps: SidebarFeedTreeProps;
  tags: Parameters<typeof useSidebarTagItems>[0]["tags"];
  tagArticleCounts: Parameters<typeof useSidebarTagItems>[0]["tagArticleCounts"];
  selection: Parameters<typeof useSidebarTagItems>[0]["selection"];
  onSelectTag: (tagId: string) => void;
  renderTagContextMenu: (tag: ReturnType<typeof useSidebarTagItems>[number]) => ReactNode;
};

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
