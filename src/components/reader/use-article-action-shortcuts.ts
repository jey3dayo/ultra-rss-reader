import { useEffect } from "react";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import type { UseArticleActionShortcutsParams } from "./article-actions.types";

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

    window.addEventListener(keyboardEvents.openInAppBrowser, keyboardShortcuts.onToggleBrowserOverlay);
    window.addEventListener(keyboardEvents.closeBrowserOverlay, keyboardShortcuts.onCloseBrowserOverlay);
    window.addEventListener(keyboardEvents.toggleRead, onToggleRead);
    window.addEventListener(keyboardEvents.toggleStar, onToggleStar);
    window.addEventListener(keyboardEvents.openExternalBrowser, onOpenExternalBrowser);
    window.addEventListener(keyboardEvents.copyLink, onCopyLink);
    window.addEventListener(keyboardEvents.addToReadingList, onAddToReadingList);

    return () => {
      window.removeEventListener(keyboardEvents.openInAppBrowser, keyboardShortcuts.onToggleBrowserOverlay);
      window.removeEventListener(keyboardEvents.closeBrowserOverlay, keyboardShortcuts.onCloseBrowserOverlay);
      window.removeEventListener(keyboardEvents.toggleRead, onToggleRead);
      window.removeEventListener(keyboardEvents.toggleStar, onToggleStar);
      window.removeEventListener(keyboardEvents.openExternalBrowser, onOpenExternalBrowser);
      window.removeEventListener(keyboardEvents.copyLink, onCopyLink);
      window.removeEventListener(keyboardEvents.addToReadingList, onAddToReadingList);
    };
  }, [keyboardShortcuts, onAddToReadingList, onCopyLink, onOpenExternalBrowser, onToggleRead, onToggleStar]);
}
