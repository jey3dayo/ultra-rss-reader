import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { List, Star } from "lucide-react";
import { useCallback } from "react";
import { UnreadIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type ViewMode = "all" | "unread" | "starred";

type ArticleListFooterProps = {
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
};

const VIEW_MODES = [
  { value: "starred", icon: Star, label: "STARRED" },
  { value: "unread", icon: null, label: "UNREAD" },
  { value: "all", icon: List, label: "ALL" },
] as const;

export function ArticleListFooter({ viewMode, onSetViewMode }: ArticleListFooterProps) {
  const handleChange = useCallback(
    (groupValue: string[]) => {
      const latest = groupValue[groupValue.length - 1] as ViewMode | undefined;
      if (latest) onSetViewMode(latest);
    },
    [onSetViewMode],
  );

  return (
    <div className="flex h-10 items-center justify-center border-t border-border bg-card">
      <ToggleGroup value={[viewMode]} onValueChange={handleChange}>
        {VIEW_MODES.map((mode) => {
          return (
            <Toggle
              key={mode.value}
              value={mode.value}
              aria-label={mode.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                "text-muted-foreground hover:text-foreground",
                "data-[pressed]:bg-muted data-[pressed]:text-foreground",
              )}
            >
              {mode.icon ? (
                <mode.icon
                  className={cn(
                    "h-3.5 w-3.5",
                    mode.value === "starred" && viewMode === "starred" && "fill-yellow-400 text-yellow-400",
                  )}
                />
              ) : (
                <UnreadIcon unread className="h-3 w-3" />
              )}
              {mode.label}
            </Toggle>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
