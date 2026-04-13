import type { ReactNode } from "react";

export type ArticleToolbarViewLabels = {
  closeView: string;
  toggleRead: string;
  toggleStar: string;
  previewToggleOff: string;
  previewToggleOn: string;
  copyLink: string;
  openInExternalBrowser: string;
};

export type ArticleToolbarViewProps = {
  showCloseButton: boolean;
  hideActionStrip?: boolean;
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
