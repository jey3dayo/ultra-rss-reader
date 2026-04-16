import type { ReactNode } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import type { ArticleActionKeyboardShortcuts } from "./article-actions.types";
import type { BrowserOverlayActionRenderer } from "./browser-view.types";

export type ArticleToolbarViewLabels = {
  closeView: string;
  toggleRead: string;
  toggleStar: string;
  previewToggleOff: string;
  previewToggleOn: string;
  copyLink: string;
  openInExternalBrowser: string;
  moreActions: string;
};

export type ArticleToolbarViewProps = {
  showCloseButton: boolean;
  hideActionStrip?: boolean;
  hasArticle?: boolean;
  canToggleRead: boolean;
  canToggleStar: boolean;
  isRead: boolean;
  isStarred: boolean;
  isBrowserOpen: boolean;
  hideBrowserOverlayActions?: boolean;
  showCopyLinkButton: boolean;
  canCopyLink: boolean;
  showOpenInBrowserButton: boolean;
  canOpenInBrowser: boolean;
  showOpenInExternalBrowserButton: boolean;
  canOpenInExternalBrowser: boolean;
  shareMenuControl?: ReactNode;
  labels: ArticleToolbarViewLabels;
  onCloseView: () => void;
  onToggleRead: (nextRead: boolean) => void;
  onToggleStar: (nextStarred: boolean) => void;
  onCopyLink: () => void;
  onOpenInBrowser: () => void;
  onOpenInExternalBrowser: () => void;
};

export type ArticleToolbarActionStripProps = Omit<ArticleToolbarViewProps, "showCloseButton" | "onCloseView">;

export type ArticleToolbarOverlayActionsProps = ArticleToolbarActionStripProps & {
  overlayActionRenderer: BrowserOverlayActionRenderer;
};

export type UseArticleToolbarControlsParams = {
  article: ArticleDto | null;
  isBrowserOpen: boolean;
  onToggleBrowserOverlay: () => void;
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
};
