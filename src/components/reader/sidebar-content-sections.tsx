import type { ReactNode, RefObject } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSidebarTagItems } from "@/components/reader/hooks/sidebar/use-sidebar-tag-items";
import { AddFeedDialog } from "./add-feed-dialog";
import type { FeedTreeEmptyState } from "./feed-tree.types";
import { FeedTreeView } from "./feed-tree-view";
import type { SidebarTagItemsParams } from "./hooks/sidebar/use-sidebar-tag-items";
import { SidebarContentView } from "./sidebar-content-view";
import type { SidebarDensity } from "./sidebar-density";
import type { SidebarFeedTreeProps } from "./sidebar-feed-section.types";
import { SidebarFeedTreeSkeleton } from "./sidebar-feed-tree-skeleton";
import { SidebarTagSection } from "./sidebar-tag-section";
import type { SidebarTagListProps } from "./tag-list-view";

export type SidebarContentSectionsProps = {
  subscriptions: {
    label: string;
    isOpen: boolean;
    onToggle: () => void;
    renderContextMenu: () => ReactNode;
  };
  viewportRef: RefObject<HTMLDivElement | null>;
  navigation: {
    subscriptionsIndexLabel: string;
    subscriptionsIndexShortLabel: string;
    settingsLabel: string;
    themeToggleLabel: string;
    onOpenSubscriptionsIndex: () => void;
    onOpenSettings: () => void;
  };
  addFeedDialog: {
    accountId: string | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
  };
  feedTree: {
    props: SidebarFeedTreeProps;
    noFolderLabel: string;
    pressPlusToAddFeedLabel: string;
    isLoading: boolean;
    showSkeleton: boolean;
  };
  tagSection: {
    isVisible: boolean;
    label: string;
    emptyLabel: NonNullable<SidebarTagListProps["emptyLabel"]>;
    isOpen: SidebarTagListProps["isOpen"];
    onToggle: SidebarTagListProps["onToggleOpen"];
    tags: SidebarTagItemsParams["tags"];
    tagArticleCounts: SidebarTagItemsParams["tagArticleCounts"];
    selection: SidebarTagItemsParams["selection"];
    onSelectTag: SidebarTagListProps["onSelectTag"];
    renderContextMenu: NonNullable<SidebarTagListProps["renderContextMenu"]>;
    renderSectionContextMenu: NonNullable<SidebarTagListProps["renderTagSectionContextMenu"]>;
  };
  sidebarDensity: SidebarDensity;
  onFocusAccountList: () => void;
};

export function SidebarContentSections({
  subscriptions,
  viewportRef,
  navigation,
  addFeedDialog,
  feedTree,
  tagSection: tagSectionProps,
  sidebarDensity,
  onFocusAccountList,
}: SidebarContentSectionsProps) {
  const { t: commonT } = useTranslation("common");
  const tagItems = useSidebarTagItems({
    tags: tagSectionProps.tags,
    tagArticleCounts: tagSectionProps.tagArticleCounts,
    selection: tagSectionProps.selection,
  });
  const feedEmptyState: FeedTreeEmptyState = addFeedDialog.accountId
    ? feedTree.isLoading
      ? { kind: "loading", label: commonT("loading") }
      : { kind: "message", message: feedTree.pressPlusToAddFeedLabel }
    : { kind: "hidden" };

  const tagSection = tagSectionProps.isVisible ? (
    <SidebarTagSection
      tagsLabel={tagSectionProps.label}
      emptyLabel={tagSectionProps.emptyLabel}
      isOpen={tagSectionProps.isOpen}
      onToggleOpen={tagSectionProps.onToggle}
      sidebarDensity={sidebarDensity}
      tags={tagItems}
      onSelectTag={tagSectionProps.onSelectTag}
      renderTagSectionContextMenu={tagSectionProps.renderSectionContextMenu}
      renderContextMenu={tagSectionProps.renderContextMenu}
    />
  ) : null;

  const addFeedDialogView = addFeedDialog.accountId ? (
    <AddFeedDialog
      open={addFeedDialog.isOpen}
      onOpenChange={addFeedDialog.onOpenChange}
      accountId={addFeedDialog.accountId}
    />
  ) : null;
  const subscriptionsSectionContextMenu = useMemo(
    () => subscriptions.renderContextMenu(),
    [subscriptions.renderContextMenu],
  );

  return (
    <SidebarContentView
      subscriptionsLabel={subscriptions.label}
      isFeedsSectionOpen={subscriptions.isOpen}
      onToggleFeedsSection={subscriptions.onToggle}
      subscriptionsSectionContextMenu={subscriptionsSectionContextMenu}
      viewportRef={viewportRef}
      feedTree={
        feedTree.showSkeleton ? (
          <SidebarFeedTreeSkeleton label={commonT("loading")} />
        ) : (
          <FeedTreeView
            {...feedTree.props}
            sidebarDensity={sidebarDensity}
            unfolderedLabel={feedTree.noFolderLabel}
            emptyState={feedEmptyState}
          />
        )
      }
      tagSection={tagSection}
      subscriptionsIndexLabel={navigation.subscriptionsIndexLabel}
      subscriptionsIndexShortLabel={navigation.subscriptionsIndexShortLabel}
      settingsLabel={navigation.settingsLabel}
      themeToggleLabel={navigation.themeToggleLabel}
      onOpenSubscriptionsIndex={navigation.onOpenSubscriptionsIndex}
      onOpenSettings={navigation.onOpenSettings}
      onFocusAccountList={onFocusAccountList}
      addFeedDialog={addFeedDialogView}
    />
  );
}
