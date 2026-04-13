import type { ReactNode } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { ArticleToolbarActionStripProps } from "./article-toolbar.types";

export type ArticlePaneProps = {
  article: ArticleDto;
  feed?: FeedDto;
  feedName?: string;
};

export type ArticleToolbarProps = {
  article: ArticleDto | null;
  isBrowserOpen: boolean;
  onCloseView: () => void;
  onToggleBrowserOverlay: () => void;
};

export type ArticleReaderBodyProps = {
  article: ArticleDto;
  feedName?: string;
};

export type BrowserOverlaySurfaceProps = {
  children?: ReactNode;
  onCloseOverlay: () => void;
  showBrowserView?: boolean;
  toolbarActions?: ReactNode;
};

export type ArticlePaneControllerResult = {
  toolbarProps: ArticleToolbarProps;
  browserOverlayProps: Omit<BrowserOverlaySurfaceProps, "children" | "toolbarActions">;
  browserOverlayActionStripProps: ArticleToolbarActionStripProps;
  showWebPreviewUnavailableWarning: boolean;
  webPreviewUnavailableLabel: string;
  showReaderBody: boolean;
  readerBodyProps: {
    "aria-hidden": boolean;
    inert?: true;
  };
};

export type ArticleEmptyStateShellProps = {
  toolbar: ReactNode;
  body: ReactNode;
};

export type BrowserOnlyStateViewProps = {
  onCloseOverlay: () => void;
};

export type ArticleNotFoundStateViewProps = {
  message: string;
};
