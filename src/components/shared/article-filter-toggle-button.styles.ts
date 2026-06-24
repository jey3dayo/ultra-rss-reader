import type { ViewMode } from "@/lib/reader/view-mode.types";
import { cn } from "@/lib/utils";
import { controlChipVariants } from "./control-chip";

export type ArticleFilterToggleMode = ViewMode;
export type ArticleFilterToggleSize = "compact" | "filter" | "comfortable";

const ARTICLE_FILTER_TONE_CLASSNAMES: Record<ArticleFilterToggleMode, string> = {
  unread:
    "text-foreground-soft hover:bg-[var(--semantic-tone-unread-surface)] hover:text-[var(--semantic-tone-unread-content-foreground)] data-[pressed]:bg-[var(--semantic-tone-unread-surface)] data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]",
  all: "text-foreground-soft hover:bg-surface-3/60 hover:text-foreground data-[pressed]:bg-surface-4 data-[pressed]:text-foreground",
  starred:
    "text-foreground-soft hover:bg-[var(--semantic-tone-starred-surface)] hover:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:bg-[var(--semantic-tone-starred-surface)] data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]",
};

export function articleFilterToggleButtonClassName({
  mode,
  size = "filter",
  className,
}: {
  mode: ArticleFilterToggleMode;
  size?: ArticleFilterToggleSize;
  className?: string;
}) {
  return cn(
    controlChipVariants({ size, interaction: "toggle" }),
    "motion-interactive-surface motion-contextual-surface rounded-md border-0 bg-transparent shadow-none select-none",
    className,
    ARTICLE_FILTER_TONE_CLASSNAMES[mode],
  );
}
