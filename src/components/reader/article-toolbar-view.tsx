import { Copy, ExternalLink, Eye, X } from "lucide-react";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { IconToolbarButton, IconToolbarToggle } from "@/components/shared/icon-toolbar-control";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  shareMenuControl?: React.ReactNode;
  labels: ArticleToolbarViewLabels;
  onCloseView: () => void;
  onToggleRead: (nextRead: boolean) => void;
  onToggleStar: (nextStarred: boolean) => void;
  onCopyLink: () => void;
  onOpenInBrowser: () => void;
  onOpenInExternalBrowser: () => void;
};

export type ArticleToolbarActionStripProps = Omit<
  ArticleToolbarViewProps,
  "showCloseButton" | "onCloseView"
>;

export function ArticleToolbarActionStrip({
  canToggleRead,
  canToggleStar,
  isRead,
  isStarred,
  isBrowserOpen,
  hideBrowserOverlayActions = false,
  showCopyLinkButton,
  canCopyLink,
  showOpenInBrowserButton,
  canOpenInBrowser,
  showOpenInExternalBrowserButton,
  canOpenInExternalBrowser,
  shareMenuControl,
  labels,
  onToggleRead,
  onToggleStar,
  onCopyLink,
  onOpenInBrowser,
  onOpenInExternalBrowser,
}: ArticleToolbarActionStripProps) {
  return (
    <div className="flex items-center gap-2">
      <IconToolbarToggle
        label={labels.toggleRead}
        pressed={isRead}
        onPressedChange={(nextRead) => onToggleRead(nextRead)}
        disabled={!canToggleRead}
      >
        <UnreadIcon unread={!isRead} className="h-3 w-3" />
      </IconToolbarToggle>
      <IconToolbarToggle
        label={labels.toggleStar}
        pressed={isStarred}
        onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
        disabled={!canToggleStar}
      >
        <StarIcon starred={isStarred} className="h-4 w-4" />
      </IconToolbarToggle>
      {showOpenInBrowserButton && !hideBrowserOverlayActions && (
        <IconToolbarToggle
          label={isBrowserOpen ? labels.previewToggleOn : labels.previewToggleOff}
          pressed={isBrowserOpen}
          onPressedChange={() => onOpenInBrowser()}
          disabled={!canOpenInBrowser}
          pressedTone="accent"
          focusTargetKey="open-in-browser"
        >
          <Eye className="h-4 w-4" />
        </IconToolbarToggle>
      )}
      {showCopyLinkButton && (
        <IconToolbarButton label={labels.copyLink} onClick={onCopyLink} disabled={!canCopyLink}>
          <Copy className="h-4 w-4" />
        </IconToolbarButton>
      )}
      {showOpenInExternalBrowserButton && !hideBrowserOverlayActions && (
        <IconToolbarButton
          label={labels.openInExternalBrowser}
          onClick={onOpenInExternalBrowser}
          disabled={!canOpenInExternalBrowser}
        >
          <ExternalLink className="h-4 w-4" />
        </IconToolbarButton>
      )}
      {shareMenuControl}
    </div>
  );
}

export function ArticleToolbarView({
  showCloseButton,
  hideActionStrip = false,
  ...actionStripProps
}: ArticleToolbarViewProps) {
  const { labels } = actionStripProps;
  return (
    <div className="flex h-12 items-center border-b border-border px-4">
      <TooltipProvider>
        <div className="flex items-center">
          {showCloseButton && (
            <IconToolbarButton label={labels.closeView} onClick={actionStripProps.onCloseView}>
              <X className="h-4 w-4" />
            </IconToolbarButton>
          )}
        </div>
        <div data-tauri-drag-region className="mx-3 h-full min-w-0 flex-1" />
        {!hideActionStrip ? <ArticleToolbarActionStrip {...actionStripProps} /> : null}
      </TooltipProvider>
    </div>
  );
}
