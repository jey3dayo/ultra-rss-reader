import { Menu } from "@base-ui/react/menu";
import { Copy, Ellipsis, ExternalLink, Eye, X } from "lucide-react";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { IconToolbarButton, IconToolbarMenuTrigger, IconToolbarToggle } from "@/components/shared/icon-toolbar-control";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleToolbarActionStripProps, ArticleToolbarViewProps } from "./article-toolbar.types";
import { contextMenuStyles } from "./context-menu-styles";

function ArticleToolbarMoreMenu({
  showCopyLinkButton,
  canCopyLink,
  showOpenInExternalBrowserButton,
  canOpenInExternalBrowser,
  labels,
  onCopyLink,
  onOpenInExternalBrowser,
}: Pick<
  ArticleToolbarActionStripProps,
  | "showCopyLinkButton"
  | "canCopyLink"
  | "showOpenInExternalBrowserButton"
  | "canOpenInExternalBrowser"
  | "labels"
  | "onCopyLink"
  | "onOpenInExternalBrowser"
>) {
  const hasActions =
    (showCopyLinkButton && canCopyLink) || (showOpenInExternalBrowserButton && canOpenInExternalBrowser);

  if (!hasActions) {
    return null;
  }

  return (
    <Menu.Root>
      <IconToolbarMenuTrigger label={labels.moreActions}>
        <Ellipsis className="h-4 w-4" />
      </IconToolbarMenuTrigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup className={contextMenuStyles.popup}>
            {showCopyLinkButton && canCopyLink ? (
              <Menu.Item className={contextMenuStyles.item} onClick={onCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                {labels.copyLink}
              </Menu.Item>
            ) : null}
            {showOpenInExternalBrowserButton && canOpenInExternalBrowser ? (
              <Menu.Item className={contextMenuStyles.item} onClick={onOpenInExternalBrowser}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {labels.openInExternalBrowser}
              </Menu.Item>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

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
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");

  return (
    <div className="flex items-center gap-1">
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
      {showCopyLinkButton && !isMobile && (
        <IconToolbarButton label={labels.copyLink} onClick={onCopyLink} disabled={!canCopyLink}>
          <Copy className="h-4 w-4" />
        </IconToolbarButton>
      )}
      {showOpenInExternalBrowserButton && !hideBrowserOverlayActions && !isMobile && (
        <IconToolbarButton
          label={labels.openInExternalBrowser}
          onClick={onOpenInExternalBrowser}
          disabled={!canOpenInExternalBrowser}
        >
          <ExternalLink className="h-4 w-4" />
        </IconToolbarButton>
      )}
      {isMobile ? (
        <ArticleToolbarMoreMenu
          showCopyLinkButton={showCopyLinkButton}
          canCopyLink={canCopyLink}
          showOpenInExternalBrowserButton={showOpenInExternalBrowserButton && !hideBrowserOverlayActions}
          canOpenInExternalBrowser={canOpenInExternalBrowser}
          labels={labels}
          onCopyLink={onCopyLink}
          onOpenInExternalBrowser={onOpenInExternalBrowser}
        />
      ) : null}
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
    <div className="sticky top-0 z-10 flex h-12 items-center border-b border-border/70 bg-background/82 px-4 backdrop-blur-sm">
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
