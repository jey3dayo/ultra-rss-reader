import { useEffect } from "react";
import type { ArticleCommands } from "@/components/reader/hooks/article/use-article-commands";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { bindWindowEvents } from "@/lib/window/window-events";
import { useUiStore } from "@/stores/ui-store";

type UseArticlePaneShortcutsParams = {
  commands: ArticleCommands;
  articleUrl: string | null;
  overlay: { onToggle: () => void; onClose: () => void };
};

export function useArticlePaneShortcuts({ commands, articleUrl, overlay }: UseArticlePaneShortcutsParams) {
  const contentMode = useUiStore((s) => s.contentMode);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const ignoreUrlShortcuts = contentMode === "browser" && (selectedArticleId === null || articleUrl === null);
  const { toggleRead, toggleStar, openInExternalBrowser, copyLink, addToReadingList } = commands;
  const { onToggle, onClose } = overlay;

  useEffect(() => {
    const whenUrlShortcutsEnabled = (action: () => void) => () => {
      if (!ignoreUrlShortcuts) {
        action();
      }
    };

    return bindWindowEvents([
      { type: keyboardEvents.openInAppBrowser, listener: onToggle },
      { type: keyboardEvents.closeBrowserOverlay, listener: onClose },
      { type: keyboardEvents.toggleRead, listener: toggleRead },
      { type: keyboardEvents.toggleStar, listener: toggleStar },
      { type: keyboardEvents.openExternalBrowser, listener: whenUrlShortcutsEnabled(openInExternalBrowser) },
      { type: keyboardEvents.copyLink, listener: whenUrlShortcutsEnabled(copyLink) },
      { type: keyboardEvents.addToReadingList, listener: whenUrlShortcutsEnabled(addToReadingList) },
    ]);
  }, [
    addToReadingList,
    copyLink,
    ignoreUrlShortcuts,
    onClose,
    onToggle,
    openInExternalBrowser,
    toggleRead,
    toggleStar,
  ]);
}
