import { ScrollArea } from "@/components/ui/scroll-area";
import type { SidebarContentViewProps } from "./sidebar.types";
import { SidebarFeedSection } from "./sidebar-feed-section";
import { SidebarFooterActions } from "./sidebar-footer-actions";

export function SidebarContentView({
  subscriptionsLabel,
  isFeedsSectionOpen,
  onToggleFeedsSection,
  subscriptionsSectionContextMenu,
  viewportRef,
  feedTree,
  tagSection,
  subscriptionsIndexLabel,
  settingsLabel,
  onOpenSubscriptionsIndex,
  onOpenSettings,
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
      >
        <div>
          {feedTree}
          {tagSection}
        </div>
      </ScrollArea>

      <SidebarFooterActions
        subscriptionsIndexLabel={subscriptionsIndexLabel}
        settingsLabel={settingsLabel}
        onOpenSubscriptionsIndex={onOpenSubscriptionsIndex}
        onOpenSettings={onOpenSettings}
      />

      {addFeedDialog}
    </>
  );
}
