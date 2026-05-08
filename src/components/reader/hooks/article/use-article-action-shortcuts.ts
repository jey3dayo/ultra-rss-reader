import { useEffect } from "react";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { bindWindowEvents } from "@/lib/window/window-events";
import type { ArticleActionKeyboardShortcuts } from "../../article-actions.types";

type UseArticleActionShortcutsParams = {
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenExternalBrowser: () => void;
  onCopyLink: () => void;
  onAddToReadingList: () => void;
};

export function useArticleActionShortcuts({
  keyboardShortcuts,
  onToggleRead,
  onToggleStar,
  onOpenExternalBrowser,
  onCopyLink,
  onAddToReadingList,
}: UseArticleActionShortcutsParams) {
  useEffect(() => {
    if (!keyboardShortcuts) {
      return;
    }

    return bindWindowEvents([
      { type: keyboardEvents.openInAppBrowser, listener: keyboardShortcuts.onToggleBrowserOverlay },
      { type: keyboardEvents.closeBrowserOverlay, listener: keyboardShortcuts.onCloseBrowserOverlay },
      { type: keyboardEvents.toggleRead, listener: onToggleRead },
      { type: keyboardEvents.toggleStar, listener: onToggleStar },
      { type: keyboardEvents.openExternalBrowser, listener: onOpenExternalBrowser },
      { type: keyboardEvents.copyLink, listener: onCopyLink },
      { type: keyboardEvents.addToReadingList, listener: onAddToReadingList },
    ]);
  }, [keyboardShortcuts, onAddToReadingList, onCopyLink, onOpenExternalBrowser, onToggleRead, onToggleStar]);
}
