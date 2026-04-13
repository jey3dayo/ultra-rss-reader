import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FeedTreeUnfolderedDropZoneProps } from "./feed-tree.types";
import { FEED_DROP_TARGET_KIND_ATTRIBUTE } from "./feed-tree-drop-target";

export function FeedTreeUnfolderedDropZone({ enabled, active, onDropToUnfoldered }: FeedTreeUnfolderedDropZoneProps) {
  const { t } = useTranslation("sidebar");

  if (!enabled) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={t("move_to_no_folder")}
      data-testid="unfoldered-drop-zone"
      {...{ [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "unfoldered" }}
      className={cn(
        "w-full rounded-md text-left transition-all",
        active
          ? "min-h-8 border border-dashed border-sidebar-border bg-sidebar-accent/60 px-2 py-1 text-xs text-sidebar-accent-foreground"
          : "h-2 border border-transparent bg-sidebar-border/30",
      )}
      onClick={() => {
        if (!enabled) {
          return;
        }
        onDropToUnfoldered?.();
      }}
    >
      {active ? t("drop_to_remove_from_folder") : null}
    </button>
  );
}
