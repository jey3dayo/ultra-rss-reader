import { ScrollArea } from "@/components/ui/scroll-area";
import type { SidebarContentViewProps } from "./sidebar.types";
import { SidebarFeedSection } from "./sidebar-feed-section";
import { SidebarFooterActions } from "./sidebar-footer-actions";

export function SidebarContentView({
  subscriptionsLabel,
  isFeedsSectionOpen,
  onToggleFeedsSection,
  viewportRef,
  feedTree,
  tagSection,
  feedCleanupLabel,
  settingsLabel,
  onOpenFeedCleanup,
  onOpenSettings,
  addFeedDialog,
}: SidebarContentViewProps) {
  return (
    <>
      <SidebarFeedSection title={subscriptionsLabel} isOpen={isFeedsSectionOpen} onToggle={onToggleFeedsSection} />

      <ScrollArea data-testid="sidebar-feed-scroll-area" className="flex-1" viewportRef={viewportRef}>
        <div className="pb-4">
          {feedTree}
          {tagSection}
        </div>
      </ScrollArea>

      <SidebarFooterActions
        feedCleanupLabel={feedCleanupLabel}
        settingsLabel={settingsLabel}
        onOpenFeedCleanup={onOpenFeedCleanup}
        onOpenSettings={onOpenSettings}
      />

      {addFeedDialog}
    </>
  );
}
