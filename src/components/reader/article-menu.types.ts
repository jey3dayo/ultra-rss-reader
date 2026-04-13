import type { ReactNode } from "react";
import type { ArticleDto } from "@/api/tauri-commands";

export type ArticleContextMenuProps = {
  article: ArticleDto;
  children: ReactNode;
};

export type ArticleContextMenuViewProps = {
  toggleReadLabel: string;
  toggleStarLabel: string;
  openInBrowserLabel?: string;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenInBrowser?: () => void;
};

export type ArticleShareMenuLabels = {
  share: string;
  copyLink: string;
  addToReadingList: string;
  addedToReadingList: string;
  shareViaEmail: string;
  linkCopied: string;
};

export type ArticleShareMenuProps = {
  article: ArticleDto | null;
  supportsReadingList: boolean;
  showToast: (message: string) => void;
  labels: ArticleShareMenuLabels;
};
