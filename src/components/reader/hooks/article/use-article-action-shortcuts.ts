import { useCallback, useEffect } from "react";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { bindWindowEvents } from "@/lib/window/window-events";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleActionKeyboardShortcuts } from "../../article-actions.types";

export type UseArticleActionShortcutsParams = {
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
  selectedArticleUrl?: string | null;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenExternalBrowser: () => void;
  onCopyLink: () => void;
  onAddToReadingList: () => void;
};

export function useArticleActionShortcuts({
  keyboardShortcuts,
  selectedArticleUrl,
  onToggleRead,
  onToggleStar,
  onOpenExternalBrowser,
  onCopyLink,
  onAddToReadingList,
}: UseArticleActionShortcutsParams) {
  const contentMode = useUiStore((s) => s.contentMode);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const shouldIgnoreUrlAction =
    contentMode === "browser" && (selectedArticleId === null || selectedArticleUrl === null);
  const handleOpenExternalBrowserShortcut = useCallback(() => {
    if (shouldIgnoreUrlAction) {
      return;
    }

    onOpenExternalBrowser();
  }, [onOpenExternalBrowser, shouldIgnoreUrlAction]);
  const handleCopyLinkShortcut = useCallback(() => {
    if (shouldIgnoreUrlAction) {
      return;
    }

    onCopyLink();
  }, [onCopyLink, shouldIgnoreUrlAction]);
  const handleAddToReadingListShortcut = useCallback(() => {
    if (shouldIgnoreUrlAction) {
      return;
    }

    onAddToReadingList();
  }, [onAddToReadingList, shouldIgnoreUrlAction]);

  useEffect(() => {
    return bindWindowEvents([
      ...(keyboardShortcuts
        ? [
            {
              type: keyboardEvents.openInAppBrowser,
              listener: keyboardShortcuts.onToggleBrowserOverlay,
            },
            {
              type: keyboardEvents.closeBrowserOverlay,
              listener: keyboardShortcuts.onCloseBrowserOverlay,
            },
          ]
        : []),
      { type: keyboardEvents.toggleRead, listener: onToggleRead },
      { type: keyboardEvents.toggleStar, listener: onToggleStar },
      {
        type: keyboardEvents.openExternalBrowser,
        listener: handleOpenExternalBrowserShortcut,
      },
      { type: keyboardEvents.copyLink, listener: handleCopyLinkShortcut },
      { type: keyboardEvents.addToReadingList, listener: handleAddToReadingListShortcut },
    ]);
  }, [
    keyboardShortcuts,
    handleAddToReadingListShortcut,
    handleCopyLinkShortcut,
    handleOpenExternalBrowserShortcut,
    onToggleRead,
    onToggleStar,
  ]);
}
