import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { Copy, Ellipsis, ExternalLink, Eye, X } from "lucide-react";
import type { ReactNode } from "react";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { IconToolbarButton, IconToolbarMenuTrigger, IconToolbarToggle } from "@/components/shared/icon-toolbar-control";
import { MotionIconSwap } from "@/components/shared/motion-icon-swap";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MOTION_ICON_SWAP_STATE_A, MOTION_ICON_SWAP_STATE_B } from "@/constants";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { contextMenuStyles } from "./context-menu-styles";

export type ArticleToolbarViewLabels = {
  closeView: string;
  toggleRead: string;
  toggleReadShort?: string;
  toggleStar: string;
  toggleStarShort?: string;
  previewToggleOff: string;
  previewToggleOffShort?: string;
  previewToggleOn: string;
  previewToggleOnShort?: string;
  copyLink: string;
  openInExternalBrowser: string;
  moreActions: string;
};

export type ArticleToolbarViewProps = {
  showCloseButton: boolean;
  hideActionStrip?: boolean;
  hasArticle?: boolean;
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
  shareMenuControl?: ReactNode;
  labels: ArticleToolbarViewLabels;
  onCloseView: () => void;
  onToggleRead: (nextRead: boolean) => void;
  onToggleStar: (nextStarred: boolean) => void;
  onCopyLink: () => void;
  onOpenInBrowser: () => void;
  onOpenInExternalBrowser: () => void;
};

export type ArticleToolbarActionStripProps = Omit<ArticleToolbarViewProps, "showCloseButton" | "onCloseView">;

export type ArticleToolbarActionResolverInput = {
  hasArticle: boolean;
  hasUrl: boolean;
  showCopyLinkPreference: boolean;
  hideBrowserOverlayActions: boolean;
  layoutMode: "wide" | "compact" | "mobile";
};

export type ArticleToolbarActionResolverResult = {
  canToggleRead: boolean;
  canToggleStar: boolean;
  showCopyLinkButton: boolean;
  canCopyLink: boolean;
  showOpenInBrowserButton: boolean;
  canOpenInBrowser: boolean;
  showOpenInExternalBrowserButton: boolean;
  canOpenInExternalBrowser: boolean;
  showExternalBrowserInMoreMenu: boolean;
};

export function resolveArticleToolbarActions({
  hasArticle,
  hasUrl,
  showCopyLinkPreference,
  hideBrowserOverlayActions,
  layoutMode,
}: ArticleToolbarActionResolverInput): ArticleToolbarActionResolverResult {
  const canUseUrl = hasArticle && hasUrl;
  const showBrowserOverlayAction = !hideBrowserOverlayActions;

  return {
    canToggleRead: hasArticle,
    canToggleStar: hasArticle,
    showCopyLinkButton: showCopyLinkPreference,
    canCopyLink: canUseUrl,
    showOpenInBrowserButton: showBrowserOverlayAction,
    canOpenInBrowser: canUseUrl,
    showOpenInExternalBrowserButton: showBrowserOverlayAction,
    canOpenInExternalBrowser: canUseUrl,
    showExternalBrowserInMoreMenu: layoutMode === "mobile" && showBrowserOverlayAction && canUseUrl,
  };
}

type ArticleToolbarVisualActiveTone = "unread" | "neutral" | "accent" | "starred";

const articleToolbarVisualActiveClassNames: Record<ArticleToolbarVisualActiveTone, string> = {
  unread:
    "bg-[var(--semantic-tone-unread-surface)] text-[var(--semantic-tone-unread-content-foreground)] hover:bg-[var(--semantic-tone-unread-surface)] hover:text-[var(--semantic-tone-unread-content-foreground)] focus-visible:bg-[var(--semantic-tone-unread-surface)] focus-visible:text-[var(--semantic-tone-unread-content-foreground)]",
  neutral:
    "bg-surface-3/72 text-foreground hover:bg-surface-3/72 hover:text-foreground focus-visible:bg-surface-3/72 focus-visible:text-foreground",
  accent:
    "bg-primary/12 text-primary hover:bg-primary/12 hover:text-primary focus-visible:bg-primary/12 focus-visible:text-primary",
  starred:
    "bg-[var(--semantic-tone-starred-surface)] text-[var(--semantic-tone-starred-content-foreground)] hover:bg-[var(--semantic-tone-starred-surface)] hover:text-[var(--semantic-tone-starred-content-foreground)] focus-visible:bg-[var(--semantic-tone-starred-surface)] focus-visible:text-[var(--semantic-tone-starred-content-foreground)]",
};

const articleToolbarUnavailableClassName =
  "disabled:opacity-35 disabled:saturate-0 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent";

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
  pressed,
  onPressedChange,
  disabled = false,
  active = false,
  activeTone = "neutral",
  children,
}: {
  label: string;
  shortLabel?: string;
  pressed: boolean;
  onPressedChange: (nextPressed: boolean) => void;
  disabled?: boolean;
  active?: boolean;
  activeTone?: ArticleToolbarVisualActiveTone;
  children: ReactNode;
}) {
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md bg-transparent text-foreground-soft shadow-none select-none hover:bg-surface-2/64 hover:text-foreground focus-visible:bg-surface-2/72 focus-visible:ring-2 focus-visible:ring-ring/45 disabled:text-foreground-soft [&_svg]:pointer-events-none [&_svg]:shrink-0",
        articleToolbarUnavailableClassName,
        active && articleToolbarVisualActiveClassNames[activeTone],
      )}
    >
      {children}
    </Toggle>
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
            pressed={isRead}
            disabled={!canToggleRead}
            onPressedChange={(nextRead) => onToggleRead(nextRead)}
            active={hasArticle && !isRead}
            activeTone="unread"
          >
            <UnreadIcon unread={hasArticle && !isRead} className="h-3 w-3" />
          </ArticleToolbarMobilePrimaryButton>
          <ArticleToolbarMobilePrimaryButton
            label={labels.toggleStar}
            shortLabel={labels.toggleStarShort}
            pressed={isStarred}
            disabled={!canToggleStar}
            onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
            active={isStarred}
            activeTone="starred"
          >
            <StarIcon starred={isStarred} className="h-4 w-4" />
          </ArticleToolbarMobilePrimaryButton>
          {showOpenInBrowserButton && !hideBrowserOverlayActions ? (
            <ArticleToolbarMobilePrimaryButton
              label={isBrowserOpen ? labels.previewToggleOn : labels.previewToggleOff}
              shortLabel={isBrowserOpen ? labels.previewToggleOnShort : labels.previewToggleOffShort}
              pressed={isBrowserOpen}
              disabled={!canOpenInBrowser}
              onPressedChange={() => onOpenInBrowser()}
              active={isBrowserOpen}
              activeTone="accent"
            >
              <MotionIconSwap
                state={isBrowserOpen ? MOTION_ICON_SWAP_STATE_B : MOTION_ICON_SWAP_STATE_A}
                iconA={<Eye className="h-4 w-4" />}
                iconB={<X className="h-4 w-4" />}
              />
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
            pressedTone="none"
            className={cn(
              articleToolbarUnavailableClassName,
              hasArticle && !isRead && articleToolbarVisualActiveClassNames.unread,
            )}
          >
            <UnreadIcon unread={hasArticle && !isRead} className="h-3 w-3" />
          </IconToolbarToggle>
          <IconToolbarToggle
            label={labels.toggleStar}
            pressed={isStarred}
            onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
            disabled={!canToggleStar}
            pressedTone="starred"
            className={articleToolbarUnavailableClassName}
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
              className={articleToolbarUnavailableClassName}
            >
              <MotionIconSwap
                state={isBrowserOpen ? MOTION_ICON_SWAP_STATE_B : MOTION_ICON_SWAP_STATE_A}
                iconA={<Eye className="h-4 w-4" />}
                iconB={<X className="h-4 w-4" />}
              />
            </IconToolbarToggle>
          ) : null}
        </>
      )}
      {showOpenInExternalBrowserButton && !hideBrowserOverlayActions && !isMobile && (
        <IconToolbarButton
          label={labels.openInExternalBrowser}
          onClick={onOpenInExternalBrowser}
          disabled={!canOpenInExternalBrowser}
          className={articleToolbarUnavailableClassName}
        >
          <ExternalLink className="h-4 w-4" />
        </IconToolbarButton>
      )}
      {showCopyLinkButton && !isMobile && (
        <IconToolbarButton
          label={labels.copyLink}
          onClick={onCopyLink}
          disabled={!canCopyLink}
          className={articleToolbarUnavailableClassName}
        >
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
