import type { ReactNode } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";

export type ArticlePaneProps = {
  article: ArticleDto;
  feed?: FeedDto;
  feedName?: string;
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
