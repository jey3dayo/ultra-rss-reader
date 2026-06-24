import { Toggle } from "@base-ui/react/toggle";
import { List } from "lucide-react";
import type { ComponentProps } from "react";
import {
  type ArticleFilterToggleMode,
  type ArticleFilterToggleSize,
  articleFilterToggleButtonClassName,
} from "./article-filter-toggle-button.styles";
import { StarIcon, UnreadIcon } from "./article-state-icon";
import { controlChipIconVariants } from "./control-chip";

export type { ArticleFilterToggleMode } from "./article-filter-toggle-button.styles";

type ArticleFilterToggleButtonProps = Omit<ComponentProps<typeof Toggle>, "className"> & {
  className?: string;
  mode: ArticleFilterToggleMode;
  showIcon?: boolean;
  size?: ArticleFilterToggleSize;
};

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
      <span data-filter-toggle-content="true" className="inline-flex items-center gap-[inherit]">
        {showIcon ? <ArticleFilterToggleIcon mode={mode} pressed={props.pressed === true} size={size} /> : null}
        {children}
      </span>
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
  size: ArticleFilterToggleSize;
}) {
  if (mode === "starred") {
    return <StarIcon starred={pressed} className={controlChipIconVariants({ size })} />;
  }

  if (mode === "all") {
    return <List className={controlChipIconVariants({ size })} />;
  }

  return <UnreadIcon unread={pressed} className="size-2.5" />;
}
