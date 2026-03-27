import { Filter, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "all" | "unread" | "starred";

type ArticleListFooterProps = {
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
};

export function ArticleListFooter({ viewMode, onSetViewMode }: ArticleListFooterProps) {
  return (
    <div className="flex h-10 items-center justify-center gap-4 border-t border-border bg-card">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Show starred"
        onClick={() => onSetViewMode("starred")}
        className={cn("text-muted-foreground", viewMode === "starred" && "text-foreground")}
      >
        <Star className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSetViewMode("unread")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
          viewMode === "unread" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        UNREAD
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Show all"
        onClick={() => onSetViewMode("all")}
        className={cn("text-muted-foreground", viewMode === "all" && "text-foreground")}
      >
        <Filter className="h-4 w-4" />
      </Button>
    </div>
  );
}
