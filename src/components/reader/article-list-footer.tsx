import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ArticleFilterToggleButton } from "@/components/shared/article-filter-toggle-button";
import type { ViewMode } from "@/lib/reader/view-mode.types";

export type ArticleListFooterProps = {
  viewMode: ViewMode;
  modes?: readonly ViewMode[];
  disabledModes?: readonly ViewMode[];
  onSetViewMode: (mode: ViewMode) => void;
};

type ArticleListFooterMode = {
  value: ViewMode;
  labelKey: "filter_unread" | "filter_all" | "filter_starred";
};

const VIEW_MODES = [
  { value: "unread", labelKey: "filter_unread" },
  { value: "all", labelKey: "filter_all" },
  { value: "starred", labelKey: "filter_starred" },
] satisfies readonly ArticleListFooterMode[];
const DEFAULT_VISIBLE_MODES: readonly ViewMode[] = ["unread", "all", "starred"];
const EMPTY_DISABLED_MODES: readonly ViewMode[] = [];

const compactFooterButtonClassName =
  "h-11 rounded-md border border-transparent bg-transparent px-3.5 text-[0.82rem] font-medium tracking-[0.01em] shadow-none hover:bg-surface-2/58 hover:text-foreground focus-visible:border-transparent focus-visible:bg-surface-3/72 focus-visible:ring-0 data-[pressed]:border-border/55 data-[pressed]:bg-surface-3/92 data-[pressed]:text-foreground data-[pressed]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-7 sm:rounded-md sm:border-0 sm:bg-transparent sm:px-3 sm:text-[13px] sm:font-medium sm:tracking-normal sm:shadow-none";

function isViewMode(value: string | undefined): value is ViewMode {
  return VIEW_MODES.some((mode) => mode.value === value);
}

export function ArticleListFooter({ viewMode, modes, disabledModes, onSetViewMode }: ArticleListFooterProps) {
  const { t } = useTranslation("reader");
  const resolvedModes = modes ?? DEFAULT_VISIBLE_MODES;
  const resolvedDisabledModes = disabledModes ?? EMPTY_DISABLED_MODES;
  const handleChange = useCallback(
    (groupValue: string[]) => {
      const latest = groupValue[groupValue.length - 1];
      if (isViewMode(latest)) onSetViewMode(latest);
    },
    [onSetViewMode],
  );

  const visibleModes = VIEW_MODES.filter((mode) => resolvedModes.includes(mode.value));

  if (visibleModes.length === 0) {
    return null;
  }

  return (
    <div className="flex h-10 items-center justify-center border-t border-border bg-card px-4">
      <ToggleGroup value={[viewMode]} onValueChange={handleChange} className="flex items-center gap-1">
        {visibleModes.map((mode) => {
          const isDisabled = resolvedDisabledModes.includes(mode.value);
          return (
            <ArticleFilterToggleButton
              key={mode.value}
              mode={mode.value}
              value={mode.value}
              pressed={viewMode === mode.value}
              aria-label={t(mode.labelKey)}
              disabled={isDisabled}
              className={compactFooterButtonClassName}
            >
              {t(mode.labelKey)}
            </ArticleFilterToggleButton>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
