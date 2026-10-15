import { cn } from "cn";
import { Copy, Ellipsis, ExternalLink, Eye, X } from "lucide-react";
import type { ReactNode } from "react";
import { MOTION_ICON_SWAP_STATE_A, MOTION_ICON_SWAP_STATE_B, MOTION_STATE_TOGGLE_CLASS_NAME } from "@/constants";
import {
  ghostUtilityActionInteractionClassName,
  IconToolbarButton,
  IconToolbarMenuTrigger,
  IconToolbarToggle,
  MotionIconSwap,
  StarIcon,
  Toggle,
  TooltipProvider,
  UnreadIcon,
} from "@/design-system";
import { Menu } from "@/design-system/menu";
import type {
  ArticleToolbarActionOptions,
  ArticleToolbarArticleState,
  ArticleToolbarLayoutMode,
} from "./article-toolbar-actions";
import { contextMenuStyles } from "./context-menu-styles";

type ArticleToolbarViewLabels = {
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

type ArticleToolbarViewProps = {
  showCloseButton: boolean;
  hideActionStrip?: boolean;
  compactChrome?: boolean;
  layoutMode?: ArticleToolbarLayoutMode;
  articleState: ArticleToolbarArticleState;
  actionOptions: ArticleToolbarActionOptions;
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

type ArticleToolbarVisualActiveTone = "unread" | "neutral" | "accent" | "starred";

const articleToolbarVisualActiveClassNames: Record<ArticleToolbarVisualActiveTone, string> = {
  unread:
    "bg-transparent text-[var(--semantic-tone-unread-content-foreground)] hover:bg-transparent hover:text-[var(--semantic-tone-unread-content-foreground)] focus-visible:bg-transparent focus-visible:text-[var(--semantic-tone-unread-content-foreground)]",
  neutral:
    "bg-transparent text-foreground hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:text-foreground",
  accent:
    "bg-transparent text-primary hover:bg-transparent hover:text-primary focus-visible:bg-transparent focus-visible:text-primary",
  starred:
    "bg-transparent text-[var(--semantic-tone-starred-content-foreground)] hover:bg-transparent hover:text-[var(--semantic-tone-starred-content-foreground)] focus-visible:bg-transparent focus-visible:text-[var(--semantic-tone-starred-content-foreground)]",
};

const articleToolbarUnavailableClassName =
  "disabled:opacity-35 disabled:saturate-0 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent";

type ArticleToolbarMoreMenuAction =
  | {
      kind: "open-in-external-browser";
      label: string;
      onSelect: () => void;
    }
  | {
      kind: "copy-link";
      label: string;
      onSelect: () => void;
    };

function ArticleToolbarMoreMenu({
  actions,
  moreActionsLabel,
}: {
  actions: readonly ArticleToolbarMoreMenuAction[];
  moreActionsLabel: string;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Menu.Root>
      <IconToolbarMenuTrigger label={moreActionsLabel}>
        <Ellipsis className="size-4" />
      </IconToolbarMenuTrigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup className={contextMenuStyles.popup}>
            {actions.map((action) => (
              <Menu.Item key={action.kind} className={contextMenuStyles.item} onClick={action.onSelect}>
                {action.kind === "open-in-external-browser" ? (
                  <ExternalLink className="mr-2 size-4" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ArticleToolbarMobilePrimaryButton({
  label,
  shortLabel,
  pressed,
  onPressedChange,
  disabled = false,
  active = false,
  activeTone = "neutral",
  motionState = false,
  children,
}: {
  label: string;
  shortLabel?: string;
  pressed: boolean;
  onPressedChange: (nextPressed: boolean) => void;
  disabled?: boolean;
  active?: boolean;
  activeTone?: ArticleToolbarVisualActiveTone;
  motionState?: boolean;
  children: ReactNode;
}) {
  const visibleLabel = shortLabel ?? label;

  return (
    <Toggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-foreground-soft select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 disabled:text-foreground-soft sm:min-w-11 sm:px-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        ghostUtilityActionInteractionClassName,
        articleToolbarUnavailableClassName,
        motionState && MOTION_STATE_TOGGLE_CLASS_NAME,
        active && articleToolbarVisualActiveClassNames[activeTone],
      )}
    >
      {children}
      <span className="min-w-0 max-w-14 truncate sm:max-w-16">{visibleLabel}</span>
    </Toggle>
  );
}

function buildArticleToolbarMoreMenuActions(
  actionOptions: ArticleToolbarActionOptions,
  labels: ArticleToolbarViewLabels,
  handlers: {
    onCopyLink: () => void;
    onOpenInExternalBrowser: () => void;
  },
): ArticleToolbarMoreMenuAction[] {
  const actions: ArticleToolbarMoreMenuAction[] = [];
  const { canCopyLink, canOpenInExternalBrowser, showCopyLinkButton, showExternalBrowserInMoreMenu } = actionOptions;

  if (showExternalBrowserInMoreMenu === true && canOpenInExternalBrowser) {
    actions.push({
      kind: "open-in-external-browser",
      label: labels.openInExternalBrowser,
      onSelect: handlers.onOpenInExternalBrowser,
    });
  }

  if (showCopyLinkButton && canCopyLink) {
    actions.push({
      kind: "copy-link",
      label: labels.copyLink,
      onSelect: handlers.onCopyLink,
    });
  }

  return actions;
}

type ArticleToolbarPrimaryActionGroupProps = {
  labels: ArticleToolbarViewLabels;
  isRead: boolean;
  isStarred: boolean;
  isBrowserOpen: boolean;
  canToggleRead: boolean;
  canToggleStar: boolean;
  showOpenInBrowserButton: boolean;
  canOpenInBrowser: boolean;
  hideBrowserOverlayActions: boolean;
  onToggleRead: (nextRead: boolean) => void;
  onToggleStar: (nextStarred: boolean) => void;
  onOpenInBrowser: () => void;
};

function ArticleToolbarMobileActionGroup({
  labels,
  isRead,
  isStarred,
  isBrowserOpen,
  canToggleRead,
  canToggleStar,
  showOpenInBrowserButton,
  canOpenInBrowser,
  hideBrowserOverlayActions,
  onToggleRead,
  onToggleStar,
  onOpenInBrowser,
}: ArticleToolbarPrimaryActionGroupProps) {
  return (
    <>
      <ArticleToolbarMobilePrimaryButton
        label={labels.toggleRead}
        shortLabel={labels.toggleReadShort}
        pressed={isRead}
        disabled={!canToggleRead}
        onPressedChange={(nextRead) => onToggleRead(nextRead)}
        active={!isRead}
        activeTone="unread"
        motionState
      >
        <UnreadIcon unread={!isRead} className="size-3" data-state-toggle-icon="true" />
      </ArticleToolbarMobilePrimaryButton>
      <ArticleToolbarMobilePrimaryButton
        label={labels.toggleStar}
        shortLabel={labels.toggleStarShort}
        pressed={isStarred}
        disabled={!canToggleStar}
        onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
        active={isStarred}
        activeTone="starred"
        motionState
      >
        <StarIcon
          starred={isStarred}
          className="size-4"
          data-state-toggle-icon="true"
          data-state-toggle-icon-tone="starred"
        />
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
            iconA={<Eye className="size-4" />}
            iconB={<X className="size-4" />}
          />
        </ArticleToolbarMobilePrimaryButton>
      ) : null}
    </>
  );
}

function ArticleToolbarDesktopActionGroup({
  labels,
  isRead,
  isStarred,
  isBrowserOpen,
  canToggleRead,
  canToggleStar,
  showOpenInBrowserButton,
  canOpenInBrowser,
  hideBrowserOverlayActions,
  onToggleRead,
  onToggleStar,
  onOpenInBrowser,
}: ArticleToolbarPrimaryActionGroupProps) {
  return (
    <>
      <IconToolbarToggle
        label={labels.toggleRead}
        pressed={isRead}
        onPressedChange={(nextRead) => onToggleRead(nextRead)}
        disabled={!canToggleRead}
        pressedTone="none"
        className={cn(
          articleToolbarUnavailableClassName,
          MOTION_STATE_TOGGLE_CLASS_NAME,
          !isRead && articleToolbarVisualActiveClassNames.unread,
        )}
      >
        <UnreadIcon unread={!isRead} className="size-3" data-state-toggle-icon="true" />
      </IconToolbarToggle>
      <IconToolbarToggle
        label={labels.toggleStar}
        pressed={isStarred}
        onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
        disabled={!canToggleStar}
        pressedTone="starred"
        className={cn(articleToolbarUnavailableClassName, MOTION_STATE_TOGGLE_CLASS_NAME)}
      >
        <StarIcon
          starred={isStarred}
          className="size-4"
          data-state-toggle-icon="true"
          data-state-toggle-icon-tone="starred"
        />
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
            iconA={<Eye className="size-4" />}
            iconB={<X className="size-4" />}
          />
        </IconToolbarToggle>
      ) : null}
    </>
  );
}

function ArticleToolbarDesktopUtilityActions({
  labels,
  showOpenInExternalBrowserButton,
  canOpenInExternalBrowser,
  showCopyLinkButton,
  canCopyLink,
  hideBrowserOverlayActions,
  onCopyLink,
  onOpenInExternalBrowser,
}: {
  labels: ArticleToolbarViewLabels;
  showOpenInExternalBrowserButton: boolean;
  canOpenInExternalBrowser: boolean;
  showCopyLinkButton: boolean;
  canCopyLink: boolean;
  hideBrowserOverlayActions: boolean;
  onCopyLink: () => void;
  onOpenInExternalBrowser: () => void;
}) {
  return (
    <>
      {showOpenInExternalBrowserButton && !hideBrowserOverlayActions ? (
        <IconToolbarButton
          label={labels.openInExternalBrowser}
          onClick={onOpenInExternalBrowser}
          disabled={!canOpenInExternalBrowser}
          className={articleToolbarUnavailableClassName}
        >
          <ExternalLink className="size-4" />
        </IconToolbarButton>
      ) : null}
      {showCopyLinkButton ? (
        <IconToolbarButton
          label={labels.copyLink}
          onClick={onCopyLink}
          disabled={!canCopyLink}
          className={articleToolbarUnavailableClassName}
        >
          <Copy className="size-4" />
        </IconToolbarButton>
      ) : null}
    </>
  );
}

export function ArticleToolbarActionStrip({
  layoutMode = "wide",
  articleState,
  actionOptions,
  shareMenuControl,
  labels,
  onToggleRead,
  onToggleStar,
  onCopyLink,
  onOpenInBrowser,
  onOpenInExternalBrowser,
}: ArticleToolbarActionStripProps) {
  const isMobile = layoutMode === "mobile";
  const moreMenuActions = buildArticleToolbarMoreMenuActions(actionOptions, labels, {
    onCopyLink,
    onOpenInExternalBrowser,
  });

  if (!articleState.hasArticle) {
    return null;
  }

  const { isRead, isStarred, isBrowserOpen } = articleState;
  const hideBrowserOverlayActions = articleState.hideBrowserOverlayActions ?? false;
  const {
    canToggleRead,
    canToggleStar,
    showCopyLinkButton,
    canCopyLink,
    showOpenInBrowserButton,
    canOpenInBrowser,
    showOpenInExternalBrowserButton,
    canOpenInExternalBrowser,
  } = actionOptions;
  const primaryActionGroupProps: ArticleToolbarPrimaryActionGroupProps = {
    labels,
    isRead,
    isStarred,
    isBrowserOpen,
    canToggleRead,
    canToggleStar,
    showOpenInBrowserButton,
    canOpenInBrowser,
    hideBrowserOverlayActions,
    onToggleRead,
    onToggleStar,
    onOpenInBrowser,
  };

  return (
    <div className={cn("flex items-center gap-1", isMobile && "min-w-0 flex-1 justify-end gap-0.5")}>
      {isMobile ? (
        <ArticleToolbarMobileActionGroup {...primaryActionGroupProps} />
      ) : (
        <ArticleToolbarDesktopActionGroup {...primaryActionGroupProps} />
      )}
      {isMobile ? (
        <ArticleToolbarMoreMenu actions={moreMenuActions} moreActionsLabel={labels.moreActions} />
      ) : (
        <ArticleToolbarDesktopUtilityActions
          labels={labels}
          showOpenInExternalBrowserButton={showOpenInExternalBrowserButton}
          canOpenInExternalBrowser={canOpenInExternalBrowser}
          showCopyLinkButton={showCopyLinkButton}
          canCopyLink={canCopyLink}
          hideBrowserOverlayActions={hideBrowserOverlayActions}
          onCopyLink={onCopyLink}
          onOpenInExternalBrowser={onOpenInExternalBrowser}
        />
      )}
      {shareMenuControl}
    </div>
  );
}

export function ArticleToolbarView({
  showCloseButton,
  hideActionStrip = false,
  compactChrome = false,
  ...actionStripProps
}: ArticleToolbarViewProps) {
  const { labels } = actionStripProps;
  const isMobile = actionStripProps.layoutMode === "mobile";
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center border-b border-border/70 px-4 backdrop-blur-sm",
        compactChrome ? "h-10" : "h-12",
        isMobile && "px-2",
      )}
      style={{ backgroundColor: "var(--reader-toolbar-surface)" }}
    >
      <TooltipProvider>
        <div className="flex items-center">
          {showCloseButton && (
            <IconToolbarButton label={labels.closeView} onClick={actionStripProps.onCloseView}>
              <X className="size-4" />
            </IconToolbarButton>
          )}
        </div>
        <div data-tauri-drag-region className={cn("h-full min-w-0 flex-1", isMobile ? "mx-1" : "mx-3")} />
        {!hideActionStrip ? <ArticleToolbarActionStrip {...actionStripProps} /> : null}
      </TooltipProvider>
    </div>
  );
}
