import type { ArticleDto } from "@/api/tauri-commands";
import type { ArticleActionKeyboardShortcuts } from "./article-actions.types";

export type UseArticleToolbarControlsParams = {
  article: ArticleDto | null;
  isBrowserOpen: boolean;
  onToggleBrowserOverlay: () => void;
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
};
