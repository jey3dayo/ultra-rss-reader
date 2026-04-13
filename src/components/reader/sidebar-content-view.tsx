import type { ReactNode, RefObject } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarFeedSection } from "./sidebar-feed-section";
import { SidebarFooterActions } from "./sidebar-footer-actions";

type SidebarContentViewProps = {
  subscriptionsLabel: string;
  isFeedsSectionOpen: boolean;
  onToggleFeedsSection: () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
  feedTree: ReactNode;
  tagSection: ReactNode;
  feedCleanupLabel: string;
  settingsLabel: string;
  onOpenFeedCleanup: () => void;
  onOpenSettings: () => void;
  addFeedDialog?: ReactNode;
};

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
