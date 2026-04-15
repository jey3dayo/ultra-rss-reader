import { useTranslation } from "react-i18next";
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
  subscriptionsIndexLabel,
  settingsLabel,
  onOpenSubscriptionsIndex,
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
  renderTagSectionContextMenu,
  sidebarDensity,
  isFeedTreeLoading,
}: SidebarContentSectionsProps) {
  const { t: commonT } = useTranslation("common");
  const tagItems = useSidebarTagItems({ tags, tagArticleCounts, selection });
  const feedEmptyState = selectedAccountId
    ? isFeedTreeLoading
      ? { kind: "loading" as const, label: commonT("loading") }
      : { kind: "message" as const, message: pressPlusToAddFeedLabel }
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

  return (
    <SidebarContentView
      subscriptionsLabel={subscriptionsLabel}
      isFeedsSectionOpen={isFeedsSectionOpen}
      onToggleFeedsSection={onToggleFeedsSection}
      viewportRef={viewportRef}
      feedTree={
        <FeedTreeView
          {...feedTreeProps}
          sidebarDensity={sidebarDensity}
          unfolderedLabel={noFolderLabel}
          emptyState={feedEmptyState}
        />
      }
      tagSection={tagSection}
      subscriptionsIndexLabel={subscriptionsIndexLabel}
      settingsLabel={settingsLabel}
      onOpenSubscriptionsIndex={onOpenSubscriptionsIndex}
      onOpenSettings={onOpenSettings}
      addFeedDialog={addFeedDialog}
    />
  );
}
