import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ArticleFilterToggleButton, ToggleGroup } from "@/design-system";
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
  "h-11 rounded-md border-0 bg-transparent px-0 text-[0.82rem] font-medium tracking-[0.01em] shadow-none hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/45 data-[pressed]:bg-transparent data-[pressed]:text-foreground sm:rounded-md sm:bg-transparent sm:px-0 sm:text-[13px] sm:font-medium sm:tracking-normal sm:shadow-none [&_[data-filter-toggle-content]]:rounded-md [&_[data-filter-toggle-content]]:px-3.5 [&_[data-filter-toggle-content]]:py-2 [&_[data-filter-toggle-content]]:transition-colors hover:[&_[data-filter-toggle-content]]:bg-surface-2/36 focus-visible:[&_[data-filter-toggle-content]]:bg-surface-2/56 data-[pressed]:[&_[data-filter-toggle-content]]:bg-surface-2/72 data-[pressed]:[&_[data-filter-toggle-content]]:shadow-active-inset-highlight sm:[&_[data-filter-toggle-content]]:px-3";

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
    <div className="flex min-h-11 items-center justify-center border-t border-border bg-card px-4">
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
