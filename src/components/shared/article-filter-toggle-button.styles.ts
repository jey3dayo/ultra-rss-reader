import type { ViewMode } from "@/lib/reader/view-mode.types";
import { cn } from "@/lib/utils";
import { controlChipVariants } from "./control-chip";

export type ArticleFilterToggleMode = ViewMode;
export type ArticleFilterToggleSize = "compact" | "filter" | "comfortable";

export const articleFilterInsetSelectionClassName =
  "h-11 rounded-md border-0 bg-transparent px-0 text-[0.82rem] font-medium tracking-[0.01em] shadow-none hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/45 data-[pressed]:bg-transparent data-[pressed]:text-foreground sm:rounded-md sm:bg-transparent sm:px-0 sm:text-[13px] sm:font-medium sm:tracking-normal sm:shadow-none [&_[data-filter-toggle-content]]:rounded-md [&_[data-filter-toggle-content]]:px-3.5 [&_[data-filter-toggle-content]]:py-2 [&_[data-filter-toggle-content]]:transition-colors hover:[&_[data-filter-toggle-content]]:bg-surface-2/36 focus-visible:[&_[data-filter-toggle-content]]:bg-surface-2/56 data-[pressed]:[&_[data-filter-toggle-content]]:bg-surface-2/72 data-[pressed]:[&_[data-filter-toggle-content]]:shadow-active-inset-highlight dark:data-[pressed]:[&_[data-filter-toggle-content]]:bg-surface-3/72 sm:[&_[data-filter-toggle-content]]:px-3";

const ARTICLE_FILTER_TONE_CLASSNAMES: Record<ArticleFilterToggleMode, string> = {
  unread:
    "text-foreground-soft hover:bg-transparent hover:text-[var(--semantic-tone-unread-content-foreground)] data-[pressed]:bg-transparent data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]",
  all: "text-foreground-soft hover:bg-transparent hover:text-foreground data-[pressed]:bg-transparent data-[pressed]:text-foreground",
  starred:
    "text-foreground-soft hover:bg-transparent hover:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:bg-transparent data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]",
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
    "motion-filter-toggle rounded-md border-0 bg-transparent shadow-none select-none",
    ARTICLE_FILTER_TONE_CLASSNAMES[mode],
    className,
  );
}
