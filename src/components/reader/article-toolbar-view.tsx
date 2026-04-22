import { Menu } from "@base-ui/react/menu";
import { Copy, Ellipsis, ExternalLink, Eye, X } from "lucide-react";
import type { ReactNode } from "react";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { IconToolbarButton, IconToolbarMenuTrigger, IconToolbarToggle } from "@/components/shared/icon-toolbar-control";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

function ArticleToolbarMobilePrimaryButton({
  label,
  shortLabel: _shortLabel,
  ariaPressed,
  disabled = false,
  onClick,
  active = false,
  children,
}: {
  label: string;
  shortLabel?: string;
  ariaPressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={ariaPressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "size-11 rounded-md border border-transparent bg-transparent text-foreground-soft shadow-none hover:bg-surface-2/72 hover:text-foreground focus-visible:border-border/60 focus-visible:bg-surface-2/72 focus-visible:ring-2 focus-visible:ring-ring/45 disabled:text-foreground-soft",
        active && "border-border/60 bg-surface-2/84 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
      )}
    >
      {children}
    </Button>
  );
}

export function ArticleToolbarActionStrip({
  hasArticle = true,
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
      {isMobile ? (
        <>
          <ArticleToolbarMobilePrimaryButton
            label={labels.toggleRead}
            shortLabel={labels.toggleReadShort}
            ariaPressed={isRead}
            disabled={!canToggleRead}
            onClick={() => onToggleRead(!isRead)}
          >
            <UnreadIcon unread={hasArticle && !isRead} className="h-3 w-3" />
          </ArticleToolbarMobilePrimaryButton>
          <ArticleToolbarMobilePrimaryButton
            label={labels.toggleStar}
            shortLabel={labels.toggleStarShort}
            ariaPressed={isStarred}
            disabled={!canToggleStar}
            onClick={() => onToggleStar(!isStarred)}
          >
            <StarIcon starred={isStarred} className="h-4 w-4" />
          </ArticleToolbarMobilePrimaryButton>
          {showOpenInBrowserButton && !hideBrowserOverlayActions ? (
            <ArticleToolbarMobilePrimaryButton
              label={isBrowserOpen ? labels.previewToggleOn : labels.previewToggleOff}
              shortLabel={isBrowserOpen ? labels.previewToggleOnShort : labels.previewToggleOffShort}
              ariaPressed={isBrowserOpen}
              disabled={!canOpenInBrowser}
              onClick={onOpenInBrowser}
              active={isBrowserOpen}
            >
              <Eye className="h-4 w-4" />
            </ArticleToolbarMobilePrimaryButton>
          ) : null}
        </>
      ) : (
        <>
          <IconToolbarToggle
            label={labels.toggleRead}
            pressed={isRead}
            onPressedChange={(nextRead) => onToggleRead(nextRead)}
            disabled={!canToggleRead}
            className="text-foreground-soft hover:text-foreground"
          >
            <UnreadIcon unread={hasArticle && !isRead} className="h-3 w-3" />
          </IconToolbarToggle>
          <IconToolbarToggle
            label={labels.toggleStar}
            pressed={isStarred}
            onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
            disabled={!canToggleStar}
            className="text-foreground-soft hover:text-foreground"
          >
            <StarIcon starred={isStarred} className="h-4 w-4" />
          </IconToolbarToggle>
          {showOpenInBrowserButton && !hideBrowserOverlayActions ? (
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
          ) : null}
        </>
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

export function ArticleToolbarView({
  showCloseButton,
  hideActionStrip = false,
  ...actionStripProps
}: ArticleToolbarViewProps) {
  const { labels } = actionStripProps;
  return (
    <div
      className="sticky top-0 z-10 flex h-12 items-center border-b border-border/70 px-4 backdrop-blur-sm"
      style={{ backgroundColor: "var(--reader-toolbar-surface)" }}
    >
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
