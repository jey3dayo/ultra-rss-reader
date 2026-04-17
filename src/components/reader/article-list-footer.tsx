import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { List } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { cn } from "@/lib/utils";
import type { ArticleListFooterProps, ArticleListViewMode } from "./article-list.types";

const VIEW_MODES = [
  { value: "unread", icon: null, labelKey: "filter_unread" },
  { value: "all", icon: "list", labelKey: "filter_all" },
  { value: "starred", icon: "star", labelKey: "filter_starred" },
] as const;
const DEFAULT_VISIBLE_MODES: readonly ArticleListViewMode[] = ["unread", "all", "starred"];
const EMPTY_DISABLED_MODES: readonly ArticleListViewMode[] = [];

const FILTER_TONE_STYLES = {
  unread: {
    button:
      "text-foreground-soft hover:text-[var(--semantic-tone-unread-content-foreground)] data-[pressed]:bg-[var(--semantic-tone-unread-surface)] data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]",
  },
  all: {
    button:
      "text-foreground-soft hover:text-foreground data-[pressed]:bg-surface-4 data-[pressed]:text-foreground data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]",
  },
  starred: {
    button:
      "text-foreground-soft hover:text-[var(--semantic-tone-starred-content-foreground)] data-[pressed]:bg-[var(--semantic-tone-starred-surface)] data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]",
  },
} as const;

export function ArticleListFooter({ viewMode, modes, disabledModes, onSetViewMode }: ArticleListFooterProps) {
  const { t } = useTranslation("reader");
  const resolvedModes = modes ?? DEFAULT_VISIBLE_MODES;
  const resolvedDisabledModes = disabledModes ?? EMPTY_DISABLED_MODES;
  const handleChange = useCallback(
    (groupValue: string[]) => {
      const latest = groupValue[groupValue.length - 1] as ArticleListViewMode | undefined;
      if (latest) onSetViewMode(latest);
    },
    [onSetViewMode],
  );

  const visibleModes = VIEW_MODES.filter((mode) => resolvedModes.includes(mode.value));

  if (visibleModes.length === 0) {
    return null;
  }

  return (
    <div className="flex h-10 items-center border-t border-border bg-card px-4">
      <ToggleGroup value={[viewMode]} onValueChange={handleChange} className="flex items-center gap-1">
        {visibleModes.map((mode) => {
          const isDisabled = resolvedDisabledModes.includes(mode.value);
          return (
            <Toggle
              key={mode.value}
              value={mode.value}
              aria-label={t(mode.labelKey)}
              disabled={isDisabled}
              className={cn(
                controlChipVariants({ size: "filter", interaction: "toggle" }),
                FILTER_TONE_STYLES[mode.value].button,
              )}
            >
              {mode.icon === "star" ? (
                <StarIcon starred={viewMode === "starred"} className={controlChipIconVariants({ size: "filter" })} />
              ) : mode.icon === "list" ? (
                <List className={controlChipIconVariants({ size: "filter" })} />
              ) : (
                <UnreadIcon unread={viewMode === "unread"} className="h-2.5 w-2.5" />
              )}
              {t(mode.labelKey)}
            </Toggle>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
