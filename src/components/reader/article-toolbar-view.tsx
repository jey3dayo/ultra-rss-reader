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
import { contextMenuStyles } from "./context-menu-styles";

type ArticleToolbarLayoutMode = "wide" | "compact" | "mobile";

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

type ArticleToolbarViewProps = {
  showCloseButton: boolean;
  hideActionStrip?: boolean;
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

export type ArticleToolbarActionResolverInput = {
  hasArticle: boolean;
  hasUrl: boolean;
  showCopyLinkPreference: boolean;
  hideBrowserOverlayActions: boolean;
  layoutMode: ArticleToolbarLayoutMode;
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

export type ArticleToolbarActionOptions = Omit<ArticleToolbarActionResolverResult, "showExternalBrowserInMoreMenu"> & {
  showExternalBrowserInMoreMenu?: ArticleToolbarActionResolverResult["showExternalBrowserInMoreMenu"];
};

export type ArticleToolbarArticleState = {
  hasArticle: boolean;
  isRead: boolean;
  isStarred: boolean;
  isBrowserOpen: boolean;
  hideBrowserOverlayActions?: boolean;
};

type ArticleToolbarActionResolverContract = {
  actionId: string;
  resultKeys: readonly (keyof ArticleToolbarActionResolverResult)[];
  actionOptionKeys: readonly (keyof ArticleToolbarActionOptions)[];
};

export const ARTICLE_TOOLBAR_ACTION_RESOLVER_CONTRACT = [
  {
    actionId: "toggle-read",
    resultKeys: ["canToggleRead"],
    actionOptionKeys: ["canToggleRead"],
  },
  {
    actionId: "toggle-star",
    resultKeys: ["canToggleStar"],
    actionOptionKeys: ["canToggleStar"],
  },
  {
    actionId: "open-in-browser",
    resultKeys: ["showOpenInBrowserButton", "canOpenInBrowser"],
    actionOptionKeys: ["showOpenInBrowserButton", "canOpenInBrowser"],
  },
  {
    actionId: "open-in-external-browser",
    resultKeys: ["showOpenInExternalBrowserButton", "canOpenInExternalBrowser", "showExternalBrowserInMoreMenu"],
    actionOptionKeys: ["showOpenInExternalBrowserButton", "canOpenInExternalBrowser", "showExternalBrowserInMoreMenu"],
  },
  {
    actionId: "copy-link",
    resultKeys: ["showCopyLinkButton", "canCopyLink"],
    actionOptionKeys: ["showCopyLinkButton", "canCopyLink"],
  },
] as const satisfies readonly ArticleToolbarActionResolverContract[];

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
  const moreMenuActions: ArticleToolbarMoreMenuAction[] = [];
  const {
    hasArticle: resolvedHasArticle,
    isRead: resolvedIsRead,
    isStarred: resolvedIsStarred,
    isBrowserOpen: resolvedIsBrowserOpen,
  } = articleState;
  const shouldHideBrowserOverlayActions = articleState.hideBrowserOverlayActions ?? false;
  const {
    canToggleRead,
    canToggleStar,
    showCopyLinkButton,
    canCopyLink,
    showOpenInBrowserButton,
    canOpenInBrowser,
    showOpenInExternalBrowserButton,
    canOpenInExternalBrowser,
    showExternalBrowserInMoreMenu,
  } = actionOptions;

  if (showExternalBrowserInMoreMenu === true && canOpenInExternalBrowser) {
    moreMenuActions.push({
      kind: "open-in-external-browser",
      label: labels.openInExternalBrowser,
      onSelect: onOpenInExternalBrowser,
    });
  }

  if (showCopyLinkButton && canCopyLink) {
    moreMenuActions.push({
      kind: "copy-link",
      label: labels.copyLink,
      onSelect: onCopyLink,
    });
  }

  return (
    <div className="flex items-center gap-1">
      {isMobile ? (
        <>
          <ArticleToolbarMobilePrimaryButton
            label={labels.toggleRead}
            shortLabel={labels.toggleReadShort}
            pressed={resolvedIsRead}
            disabled={!canToggleRead}
            onPressedChange={(nextRead) => onToggleRead(nextRead)}
            active={resolvedHasArticle && !resolvedIsRead}
            activeTone="unread"
          >
            <UnreadIcon unread={resolvedHasArticle && !resolvedIsRead} className="size-3" />
          </ArticleToolbarMobilePrimaryButton>
          <ArticleToolbarMobilePrimaryButton
            label={labels.toggleStar}
            shortLabel={labels.toggleStarShort}
            pressed={resolvedIsStarred}
            disabled={!canToggleStar}
            onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
            active={resolvedIsStarred}
            activeTone="starred"
          >
            <StarIcon starred={resolvedIsStarred} className="size-4" />
          </ArticleToolbarMobilePrimaryButton>
          {showOpenInBrowserButton && !shouldHideBrowserOverlayActions ? (
            <ArticleToolbarMobilePrimaryButton
              label={resolvedIsBrowserOpen ? labels.previewToggleOn : labels.previewToggleOff}
              shortLabel={resolvedIsBrowserOpen ? labels.previewToggleOnShort : labels.previewToggleOffShort}
              pressed={resolvedIsBrowserOpen}
              disabled={!canOpenInBrowser}
              onPressedChange={() => onOpenInBrowser()}
              active={resolvedIsBrowserOpen}
              activeTone="accent"
            >
              <MotionIconSwap
                state={resolvedIsBrowserOpen ? MOTION_ICON_SWAP_STATE_B : MOTION_ICON_SWAP_STATE_A}
                iconA={<Eye className="size-4" />}
                iconB={<X className="size-4" />}
              />
            </ArticleToolbarMobilePrimaryButton>
          ) : null}
        </>
      ) : (
        <>
          <IconToolbarToggle
            label={labels.toggleRead}
            pressed={resolvedIsRead}
            onPressedChange={(nextRead) => onToggleRead(nextRead)}
            disabled={!canToggleRead}
            pressedTone="none"
            className={cn(
              articleToolbarUnavailableClassName,
              resolvedHasArticle && !resolvedIsRead && articleToolbarVisualActiveClassNames.unread,
            )}
          >
            <UnreadIcon unread={resolvedHasArticle && !resolvedIsRead} className="size-3" />
          </IconToolbarToggle>
          <IconToolbarToggle
            label={labels.toggleStar}
            pressed={resolvedIsStarred}
            onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
            disabled={!canToggleStar}
            pressedTone="starred"
            className={articleToolbarUnavailableClassName}
          >
            <StarIcon starred={resolvedIsStarred} className="size-4" />
          </IconToolbarToggle>
          {showOpenInBrowserButton && !shouldHideBrowserOverlayActions ? (
            <IconToolbarToggle
              label={resolvedIsBrowserOpen ? labels.previewToggleOn : labels.previewToggleOff}
              pressed={resolvedIsBrowserOpen}
              onPressedChange={() => onOpenInBrowser()}
              disabled={!canOpenInBrowser}
              pressedTone="accent"
              focusTargetKey="open-in-browser"
              className={articleToolbarUnavailableClassName}
            >
              <MotionIconSwap
                state={resolvedIsBrowserOpen ? MOTION_ICON_SWAP_STATE_B : MOTION_ICON_SWAP_STATE_A}
                iconA={<Eye className="size-4" />}
                iconB={<X className="size-4" />}
              />
            </IconToolbarToggle>
          ) : null}
        </>
      )}
      {showOpenInExternalBrowserButton && !shouldHideBrowserOverlayActions && !isMobile && (
        <IconToolbarButton
          label={labels.openInExternalBrowser}
          onClick={onOpenInExternalBrowser}
          disabled={!canOpenInExternalBrowser}
          className={articleToolbarUnavailableClassName}
        >
          <ExternalLink className="size-4" />
        </IconToolbarButton>
      )}
      {showCopyLinkButton && !isMobile && (
        <IconToolbarButton
          label={labels.copyLink}
          onClick={onCopyLink}
          disabled={!canCopyLink}
          className={articleToolbarUnavailableClassName}
        >
          <Copy className="size-4" />
        </IconToolbarButton>
      )}
      {isMobile ? <ArticleToolbarMoreMenu actions={moreMenuActions} moreActionsLabel={labels.moreActions} /> : null}
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
              <X className="size-4" />
            </IconToolbarButton>
          )}
        </div>
        <div data-tauri-drag-region className="mx-3 h-full min-w-0 flex-1" />
        {!hideActionStrip ? <ArticleToolbarActionStrip {...actionStripProps} /> : null}
      </TooltipProvider>
    </div>
  );
}
