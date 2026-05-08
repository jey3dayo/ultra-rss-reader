import type { MouseEventHandler, ReactNode } from "react";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { ResolvedArticleDisplay } from "@/lib/article-display";
import type { ContentMode } from "@/lib/ui-state.types";
import type { BrowserOverlayToolbarAction } from "./browser-view.types";

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
  onOpenArticleTitleInWebPreview?: () => void;
};

export type ArticleContentViewProps = {
  thumbnailUrl?: string | null;
  contentHtml: string;
  feedName?: string | null;
};

export type ArticleMetaViewProps = {
  title: string;
  author?: string | null;
  feedName?: string | null;
  publishedLabel: string;
  onTitleClick?: MouseEventHandler<HTMLButtonElement>;
  onTitleAuxClick?: MouseEventHandler<HTMLButtonElement>;
  onFeedClick?: () => void;
};

export type BrowserOverlaySurfaceProps = {
  children?: ReactNode;
  onCloseOverlay: () => void;
  showBrowserView?: boolean;
  toolbarActions?: BrowserOverlayToolbarAction[];
};

export type ArticlePaneControllerResult = {
  toolbarProps: ArticleToolbarProps;
  browserOverlayProps: Omit<BrowserOverlaySurfaceProps, "children" | "toolbarActions">;
  browserOverlayToolbarActions?: BrowserOverlayToolbarAction[];
  showWebPreviewUnavailableWarning: boolean;
  webPreviewUnavailableLabel: string;
  showReaderBody: boolean;
  readerBodyProps: {
    onOpenArticleTitleInWebPreview: () => void;
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

export type ArticleEmptyStateViewProps = {
  eyebrow?: string;
  message: string;
  description?: string;
  hints?: string[];
  containerClassName?: string;
  cardClassName?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "link";
  }>;
};

export type UseArticleBrowserOverlayParams = {
  articleId: string;
  articleUrl: string | null;
  browserUrl: string | null;
  contentMode: ContentMode;
  feed?: FeedDto;
};

export type UseArticleBrowserOverlayResult = {
  isBrowserOpen: boolean;
  resolvedDisplay: ResolvedArticleDisplay;
  handleOpenBrowserOverlay: () => void;
  handleCloseBrowserOverlay: () => void;
  handleToggleBrowserOverlay: () => void;
};

export type UseArticleBrowserOverlayCloseParams = {
  closeBrowser: () => void;
  focusSelectedArticleRow: () => void;
  setBrowserCloseInFlight: (inFlight: boolean) => void;
  setBrowserOverlayClosedPreference: () => void;
};

export type UseArticleBrowserOverlayDisplayParams = {
  articleId: string;
  articleUrl: string | null;
  feed?: FeedDto;
};

export type UseArticleBrowserOverlayDisplayResult = {
  requestedDisplay: ResolvedArticleDisplay;
  resolvedDisplay: ResolvedArticleDisplay;
  shouldShowBrowserOverlay: boolean;
  setBrowserOverlayOpenPreference: () => void;
  setBrowserOverlayClosedPreference: () => void;
};
