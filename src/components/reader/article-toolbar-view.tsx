import { Toggle } from "@base-ui/react/toggle";
import { ArrowLeft, Copy, ExternalLink, Globe } from "lucide-react";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ArticleToolbarViewLabels = {
  showSidebar: string;
  toggleRead: string;
  toggleStar: string;
  copyLink: string;
  viewInBrowser: string;
  openInExternalBrowser: string;
};

export type ArticleToolbarViewProps = {
  showSidebarButton: boolean;
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
  labels: ArticleToolbarViewLabels;
  onShowSidebar: () => void;
  onToggleRead: (nextRead: boolean) => void;
  onToggleStar: (nextStarred: boolean) => void;
  onCopyLink: () => void;
  onOpenInBrowser: () => void;
  onOpenInExternalBrowser: () => void;
};

export function ArticleToolbarView({
  showSidebarButton,
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
  labels,
  onShowSidebar,
  onToggleRead,
  onToggleStar,
  onCopyLink,
  onOpenInBrowser,
  onOpenInExternalBrowser,
}: ArticleToolbarViewProps) {
  return (
    <div data-tauri-drag-region className="flex h-12 items-center justify-between border-b border-border px-4">
      <div>
        {showSidebarButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShowSidebar}
            className="text-muted-foreground"
            aria-label={labels.showSidebar}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Toggle
          pressed={isRead}
          onPressedChange={(nextRead) => onToggleRead(nextRead)}
          disabled={!canToggleRead}
          aria-label={labels.toggleRead}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
        >
          <UnreadIcon unread={!isRead} className="h-3 w-3" />
        </Toggle>
        <Toggle
          pressed={isStarred}
          onPressedChange={(nextStarred) => onToggleStar(nextStarred)}
          disabled={!canToggleStar}
          aria-label={labels.toggleStar}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
        >
          <StarIcon starred={isStarred} className="h-4 w-4" />
        </Toggle>
        {showCopyLinkButton && (
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
        )}
        {showOpenInBrowserButton && (
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
        )}
        {showOpenInExternalBrowserButton && (
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
        )}
      </div>
    </div>
  );
}
