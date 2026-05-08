import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { ResolvedArticleDisplay } from "@/lib/articles/article-display";
import type { ContentMode } from "@/lib/layout/layout-state.types";
import type { BrowserOverlayToolbarAction } from "./browser-view.types";

export type ArticlePaneProps = {
  article: ArticleDto;
  feed?: FeedDto;
  feedName?: string;
};

type ArticlePaneToolbarState = {
  article: ArticleDto | null;
  isBrowserOpen: boolean;
  onCloseView: () => void;
  onToggleBrowserOverlay: () => void;
};

type ArticlePaneBrowserOverlayState = {
  onCloseOverlay: () => void;
  showBrowserView?: boolean;
};

export type ArticlePaneControllerResult = {
  toolbarProps: ArticlePaneToolbarState;
  browserOverlayProps: ArticlePaneBrowserOverlayState;
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
