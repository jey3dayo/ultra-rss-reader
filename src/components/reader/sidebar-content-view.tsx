import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_EVENTS } from "@/constants/events";
import type { SidebarContentViewProps } from "./sidebar.types";
import { SidebarFeedSection } from "./sidebar-feed-section";
import { SidebarFooterActions } from "./sidebar-footer-actions";

function focusSelectedSubscriptionFeed(attemptsRemaining = 12) {
  const target = document.querySelector<HTMLElement>('[data-sidebar-selected-target="true"][data-feed-id]');
  target?.focus({ preventScroll: true });
  target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });

  if (attemptsRemaining <= 1) {
    return;
  }

  window.setTimeout(() => focusSelectedSubscriptionFeed(attemptsRemaining - 1), 50);
}

function handleSubscriptionListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.defaultPrevented || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest("[data-feed-id]")) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  window.dispatchEvent(
    new CustomEvent(APP_EVENTS.navigateFeed, {
      detail: event.key === "ArrowDown" ? 1 : -1,
    }),
  );
  focusSelectedSubscriptionFeed();
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
        onKeyDown={handleSubscriptionListKeyDown}
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
