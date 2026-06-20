import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { ScrollArea } from "@/design-system";
import { focusArticleListRowTargetWhenReady } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";
import { SidebarFeedSection } from "./sidebar-feed-section";
import { SidebarFooterActions } from "./sidebar-footer-actions";

type SidebarContentViewProps = {
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

function focusArticleListPane() {
  const store = useUiStore.getState();
  store.setFocusedPane("list");
  focusArticleListRowTargetWhenReady(store.selectedArticleId);
}

function handleSubscriptionListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, onFocusAccountList: () => void) {
  if (event.defaultPrevented || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  const sidebarTarget = target?.closest('[data-sidebar-navigation-target="true"]');
  if (!sidebarTarget) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "ArrowLeft") {
    onFocusAccountList();
    return;
  }

  if (event.key === "ArrowRight") {
    focusArticleListPane();
    return;
  }
}

export function SidebarContentView({
  subscriptionsLabel,
  isFeedsSectionOpen,
  onToggleFeedsSection,
  subscriptionsSectionContextMenu,
  viewportRef,
  feedTree,
  tagSection,
  subscriptionsIndexLabel,
  subscriptionsIndexShortLabel,
  settingsLabel,
  themeToggleLabel,
  onOpenSubscriptionsIndex,
  onOpenSettings,
  onFocusAccountList,
  addFeedDialog,
}: SidebarContentViewProps) {
  return (
    <>
      <SidebarFeedSection
        title={subscriptionsLabel}
        isOpen={isFeedsSectionOpen}
        onToggle={onToggleFeedsSection}
        contextMenu={subscriptionsSectionContextMenu}
      />

      <ScrollArea
        data-testid="sidebar-feed-scroll-area"
        className="flex-1"
        contentClassName="pb-4 pr-3"
        viewportRef={viewportRef}
        onKeyDown={(event) => handleSubscriptionListKeyDown(event, onFocusAccountList)}
      >
        <div>
          {feedTree}
          {tagSection}
        </div>
      </ScrollArea>

      <SidebarFooterActions
        subscriptionsIndexLabel={subscriptionsIndexLabel}
        subscriptionsIndexShortLabel={subscriptionsIndexShortLabel}
        settingsLabel={settingsLabel}
        themeToggleLabel={themeToggleLabel}
        onOpenSubscriptionsIndex={onOpenSubscriptionsIndex}
        onOpenSettings={onOpenSettings}
      />

      {addFeedDialog}
    </>
  );
}
