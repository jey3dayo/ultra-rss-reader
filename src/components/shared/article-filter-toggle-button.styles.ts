import type { ViewMode } from "@/lib/reader/view-mode.types";
import { cn } from "@/lib/utils";
import { controlChipVariants } from "./control-chip";

export type ArticleFilterToggleMode = ViewMode;
export type ArticleFilterToggleSize = "compact" | "filter" | "comfortable";

export const articleFilterInsetSelectionClassName =
  // hover / pressed text color is intentionally not set here so the per-mode
  // tone classes (unread / starred semantic tones) keep owning the active color.
  // Focus ring is applied to the inner [data-filter-toggle-content] pill, not this
  // outer h-11 hit target, so it hugs the visible pill instead of the full tap area.
  "h-11 rounded-md border-0 bg-transparent px-0 text-[0.82rem] font-medium tracking-[0.01em] shadow-none hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none data-[pressed]:bg-transparent disabled:cursor-default disabled:opacity-[0.45] disabled:text-foreground-muted disabled:hover:text-foreground-muted sm:rounded-md sm:bg-transparent sm:px-0 sm:text-[13px] sm:font-medium sm:tracking-normal sm:shadow-none [&_[data-filter-toggle-content]]:rounded-md [&_[data-filter-toggle-content]]:px-3.5 [&_[data-filter-toggle-content]]:py-2 [&_[data-filter-toggle-content]]:transition-colors hover:[&_[data-filter-toggle-content]]:bg-surface-2/36 disabled:hover:[&_[data-filter-toggle-content]]:bg-transparent focus-visible:[&_[data-filter-toggle-content]]:bg-surface-2/56 focus-visible:[&_[data-filter-toggle-content]]:ring-2 focus-visible:[&_[data-filter-toggle-content]]:ring-ring/45 data-[pressed]:[&_[data-filter-toggle-content]]:bg-surface-2/72 data-[pressed]:[&_[data-filter-toggle-content]]:shadow-active-inset-highlight dark:data-[pressed]:[&_[data-filter-toggle-content]]:bg-surface-3/72 sm:[&_[data-filter-toggle-content]]:px-3";

const ARTICLE_FILTER_TONE_CLASSNAMES: Record<ArticleFilterToggleMode, string> = {
  unread:
    "text-foreground-soft hover:bg-transparent hover:text-[var(--semantic-tone-unread-content-foreground)] disabled:hover:text-foreground-muted data-[pressed]:bg-transparent data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]",
  all: "text-foreground-soft hover:bg-transparent hover:text-foreground disabled:hover:text-foreground-muted data-[pressed]:bg-transparent data-[pressed]:text-foreground",
  starred:
    "text-foreground-soft hover:bg-transparent hover:text-[var(--semantic-tone-starred-content-foreground)] disabled:hover:text-foreground-muted data-[pressed]:bg-transparent data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]",
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
    "motion-filter-toggle rounded-md border-0 bg-transparent shadow-none select-none disabled:cursor-default disabled:opacity-[0.45]",
    ARTICLE_FILTER_TONE_CLASSNAMES[mode],
    className,
  );
}
