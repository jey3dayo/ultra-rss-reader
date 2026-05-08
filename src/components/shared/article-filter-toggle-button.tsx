import { Toggle } from "@base-ui/react/toggle";
import { List } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/view-mode.types";
import { StarIcon, UnreadIcon } from "./article-state-icon";
import { controlChipIconVariants, controlChipVariants } from "./control-chip";

export type ArticleFilterToggleMode = ViewMode;

type ArticleFilterToggleButtonProps = Omit<ComponentProps<typeof Toggle>, "className"> & {
  className?: string;
  mode: ArticleFilterToggleMode;
  showIcon?: boolean;
  size?: "compact" | "filter" | "comfortable";
};

const ARTICLE_FILTER_TONE_CLASSNAMES: Record<ArticleFilterToggleMode, string> = {
  unread:
    "text-foreground-soft hover:text-[var(--semantic-tone-unread-content-foreground)] data-[pressed]:bg-[var(--semantic-tone-unread-surface)] data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]",
  all: "text-foreground-soft hover:text-foreground data-[pressed]:bg-surface-4 data-[pressed]:text-foreground data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]",
  starred:
    "text-foreground-soft hover:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:bg-[var(--semantic-tone-starred-surface)] data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]",
};

export function articleFilterToggleButtonClassName({
  mode,
  size = "filter",
  className,
}: {
  mode: ArticleFilterToggleMode;
  size?: ArticleFilterToggleButtonProps["size"];
  className?: string;
}) {
  return cn(
    controlChipVariants({ size, interaction: "toggle" }),
    "motion-interactive-surface motion-contextual-surface rounded-md select-none",
    className,
    ARTICLE_FILTER_TONE_CLASSNAMES[mode],
  );
}

export function ArticleFilterToggleButton({
  mode,
  showIcon = true,
  size = "filter",
  className,
  children,
  ...props
}: ArticleFilterToggleButtonProps) {
  return (
    <Toggle className={articleFilterToggleButtonClassName({ mode, size, className })} {...props}>
      {showIcon ? <ArticleFilterToggleIcon mode={mode} pressed={props.pressed === true} size={size} /> : null}
      {children}
    </Toggle>
  );
}

function ArticleFilterToggleIcon({
  mode,
  pressed,
  size,
}: {
  mode: ArticleFilterToggleMode;
  pressed: boolean;
  size: NonNullable<ArticleFilterToggleButtonProps["size"]>;
}) {
  if (mode === "starred") {
    return <StarIcon starred={pressed} className={controlChipIconVariants({ size })} />;
  }

  if (mode === "all") {
    return <List className={controlChipIconVariants({ size })} />;
  }

  return <UnreadIcon unread={pressed} className="h-2.5 w-2.5" />;
}
