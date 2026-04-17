import { useEffect } from "react";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import type { UseArticleActionShortcutsParams } from "./article-actions.types";
import { bindWindowEvents } from "./use-browser-url-effect";

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
