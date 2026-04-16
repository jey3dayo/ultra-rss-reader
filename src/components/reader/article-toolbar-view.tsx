import { Menu } from "@base-ui/react/menu";
import { Copy, Ellipsis, ExternalLink, Eye, X } from "lucide-react";
import type { ReactNode } from "react";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import {
  IconToolbarButton,
  IconToolbarMenuTrigger,
  IconToolbarToggle,
  iconToolbarSurfaceControlVariants,
} from "@/components/shared/icon-toolbar-control";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type {
  ArticleToolbarActionStripProps,
  ArticleToolbarOverlayActionsProps,
  ArticleToolbarViewProps,
} from "./article-toolbar.types";
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
            {showOpenInExternalBrowserButton && canOpenInExternalBrowser ? (
              <Menu.Item className={contextMenuStyles.item} onClick={onOpenInExternalBrowser}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {labels.openInExternalBrowser}
              </Menu.Item>
            ) : null}
            {showCopyLinkButton && canCopyLink ? (
              <Menu.Item className={contextMenuStyles.item} onClick={onCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                {labels.copyLink}
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
      {showOpenInExternalBrowserButton && !hideBrowserOverlayActions && !isMobile && (
        <IconToolbarButton
          label={labels.openInExternalBrowser}
          onClick={onOpenInExternalBrowser}
          disabled={!canOpenInExternalBrowser}
        >
          <ExternalLink className="h-4 w-4" />
        </IconToolbarButton>
      )}
      {showCopyLinkButton && !isMobile && (
        <IconToolbarButton label={labels.copyLink} onClick={onCopyLink} disabled={!canCopyLink}>
          <Copy className="h-4 w-4" />
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

function ArticleToolbarOverlayActionButton({
  overlayActionRenderer,
  label,
  disabled = false,
  pressed,
  pressedTone,
  onClick,
  focusTargetKey,
  children,
}: {
  overlayActionRenderer: ArticleToolbarOverlayActionsProps["overlayActionRenderer"];
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  pressedTone?: "none" | "neutral" | "accent";
  onClick: () => void;
  focusTargetKey?: string;
  children: ReactNode;
}) {
  const buttonClassName = cn(iconToolbarSurfaceControlVariants({ pressedTone }), "size-full");

  return overlayActionRenderer.renderAction(
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-browser-overlay-return-focus={focusTargetKey}
      onClick={onClick}
      className={buttonClassName}
    >
      {children}
    </button>,
  );
}

export function ArticleToolbarOverlayActions({
  overlayActionRenderer,
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
}: ArticleToolbarOverlayActionsProps) {
  return (
    <>
      <ArticleToolbarOverlayActionButton
        overlayActionRenderer={overlayActionRenderer}
        label={labels.toggleRead}
        disabled={!canToggleRead}
        pressed={isRead}
        onClick={() => onToggleRead(!isRead)}
      >
        <UnreadIcon unread={!isRead} className="h-3 w-3" />
      </ArticleToolbarOverlayActionButton>
      <ArticleToolbarOverlayActionButton
        overlayActionRenderer={overlayActionRenderer}
        label={labels.toggleStar}
        disabled={!canToggleStar}
        pressed={isStarred}
        onClick={() => onToggleStar(!isStarred)}
      >
        <StarIcon starred={isStarred} className="h-4 w-4" />
      </ArticleToolbarOverlayActionButton>
      {showOpenInBrowserButton && !hideBrowserOverlayActions ? (
        <ArticleToolbarOverlayActionButton
          overlayActionRenderer={overlayActionRenderer}
          label={isBrowserOpen ? labels.previewToggleOn : labels.previewToggleOff}
          disabled={!canOpenInBrowser}
          pressed={isBrowserOpen}
          pressedTone="accent"
          onClick={onOpenInBrowser}
          focusTargetKey="open-in-browser"
        >
          <Eye className="h-4 w-4" />
        </ArticleToolbarOverlayActionButton>
      ) : null}
      {showOpenInExternalBrowserButton && !hideBrowserOverlayActions ? (
        <ArticleToolbarOverlayActionButton
          overlayActionRenderer={overlayActionRenderer}
          label={labels.openInExternalBrowser}
          disabled={!canOpenInExternalBrowser}
          onClick={onOpenInExternalBrowser}
        >
          <ExternalLink className="h-4 w-4" />
        </ArticleToolbarOverlayActionButton>
      ) : null}
      {showCopyLinkButton ? (
        <ArticleToolbarOverlayActionButton
          overlayActionRenderer={overlayActionRenderer}
          label={labels.copyLink}
          disabled={!canCopyLink}
          onClick={onCopyLink}
        >
          <Copy className="h-4 w-4" />
        </ArticleToolbarOverlayActionButton>
      ) : null}
      {shareMenuControl ? overlayActionRenderer.renderAction(shareMenuControl, { key: "share-menu" }) : null}
    </>
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
