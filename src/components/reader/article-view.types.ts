import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { BrowserOverlayToolbarAction } from "./browser-view.types";

export type ArticlePaneProps = {
  article: ArticleDto;
  feed?: FeedDto;
  feedName?: string;
};

export type ArticlePaneToolbarState = {
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
