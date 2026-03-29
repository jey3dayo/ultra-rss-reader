import { Toggle } from "@base-ui/react/toggle";
import { Copy, ExternalLink, Globe, X } from "lucide-react";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ArticleToolbarViewLabels = {
  closeView: string;
  toggleRead: string;
  toggleStar: string;
  copyLink: string;
  viewInBrowser: string;
  openInExternalBrowser: string;
};

export type ArticleToolbarViewProps = {
  showCloseButton: boolean;
  canToggleRead: boolean;
  canToggleStar: boolean;
  isRead: boolean;
  isStarred: boolean;
  showCopyLinkButton: boolean;
  canCopyLink: boolean;
  showOpenInBrowserButton: boolean;
  canOpenInBrowser: boolean;
  showOpenInExternalBrowserButton: boolean;
  canOpenInExternalBrowser: boolean;
  displayModeControl?: React.ReactNode;
  shareMenuControl?: React.ReactNode;
  labels: ArticleToolbarViewLabels;
  onCloseView: () => void;
  onToggleRead: (nextRead: boolean) => void;
  onToggleStar: (nextStarred: boolean) => void;
  onCopyLink: () => void;
  onOpenInBrowser: () => void;
  onOpenInExternalBrowser: () => void;
};

export function ArticleToolbarView({
  showCloseButton,
  canToggleRead,
  canToggleStar,
  isRead,
  isStarred,
  showCopyLinkButton,
  canCopyLink,
  showOpenInBrowserButton,
  canOpenInBrowser,
  showOpenInExternalBrowserButton,
  canOpenInExternalBrowser,
  displayModeControl,
  shareMenuControl,
  labels,
  onCloseView,
  onToggleRead,
  onToggleStar,
  onCopyLink,
  onOpenInBrowser,
  onOpenInExternalBrowser,
}: ArticleToolbarViewProps) {
  return (
    <div data-tauri-drag-region className="flex h-12 items-center justify-between border-b border-border px-4">
      <div>
        {showCloseButton && (
          <TooltipProvider>
            <AppTooltip label={labels.closeView}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseView}
                className="text-muted-foreground"
                aria-label={labels.closeView}
              >
                <X className="h-4 w-4" />
              </Button>
            </AppTooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <AppTooltip label={labels.toggleRead}>
            <Toggle
              pressed={isRead}
              onPressedChange={(nextRead) => onToggleRead(nextRead)}
              disabled={!canToggleRead}
              aria-label={labels.toggleRead}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
            >
              <UnreadIcon unread={!isRead} className="h-3 w-3" />
            </Toggle>
          </AppTooltip>
          <AppTooltip label={labels.toggleStar}>
            <Toggle
              pressed={isStarred}
              onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
              disabled={!canToggleStar}
              aria-label={labels.toggleStar}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
            >
              <StarIcon starred={isStarred} className="h-4 w-4" />
            </Toggle>
          </AppTooltip>
          {displayModeControl}
          {showCopyLinkButton && (
            <AppTooltip label={labels.copyLink}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopyLink}
                className="text-muted-foreground"
                disabled={!canCopyLink}
                aria-label={labels.copyLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </AppTooltip>
          )}
          {showOpenInBrowserButton && (
            <AppTooltip label={labels.viewInBrowser}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenInBrowser}
                className="text-muted-foreground"
                disabled={!canOpenInBrowser}
                aria-label={labels.viewInBrowser}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </AppTooltip>
          )}
          {showOpenInExternalBrowserButton && (
            <AppTooltip label={labels.openInExternalBrowser}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenInExternalBrowser}
                className="text-muted-foreground"
                disabled={!canOpenInExternalBrowser}
                aria-label={labels.openInExternalBrowser}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </AppTooltip>
          )}
          {shareMenuControl}
        </TooltipProvider>
      </div>
    </div>
  );
}
