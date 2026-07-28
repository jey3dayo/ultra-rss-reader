import { type ReactElement, type MouseEvent as ReactMouseEvent, useRef } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { ContextMenu } from "@/design-system/context-menu";
import { useContextMenuTargetSnapshot } from "./context-menu-target";
import { FeedContextMenuContent } from "./feed-context-menu";

type FeedContextMenuTriggerProps = {
  feed: FeedDto;
  onSelect?: () => void;
  render: ReactElement;
};

/**
 * Shared feed context menu wiring for sidebar rows and summary feed cards.
 * Mirrors feed-tree-row.tsx: the feed is snapshotted while the menu is open so
 * menu labels and actions keep using the field values the user right-clicked.
 */
export function FeedContextMenuTrigger({ feed, onSelect, render }: FeedContextMenuTriggerProps) {
  const { contextMenuTarget, captureTarget, captureKeyboardTarget, clearTarget } = useContextMenuTargetSnapshot(feed);
  const isMenuOpenRef = useRef(false);

  // Some webviews emit `click` alongside `contextmenu` (macOS ctrl+click, touch
  // long-press). On summary cards selecting replaces the view that owns this
  // menu, so an unguarded select would navigate away and unmount the popup.
  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (isMenuOpenRef.current || event.ctrlKey) {
      return;
    }

    onSelect?.();
  };

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        isMenuOpenRef.current = open;
        if (!open) {
          clearTarget();
        }
      }}
    >
      <ContextMenu.Trigger
        render={render}
        onContextMenu={captureTarget}
        onKeyDownCapture={captureKeyboardTarget}
        onClick={handleClick}
      />
      <FeedContextMenuContent feed={contextMenuTarget} />
    </ContextMenu.Root>
  );
}
