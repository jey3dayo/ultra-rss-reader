import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArticleFilterToggleButton, articleFilterInsetSelectionClassName, ToggleGroup } from "@/design-system";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import { useReaderPassiveLayoutNotify } from "./reader-passive-layout";

export type ArticleListFooterProps = {
  viewMode: ViewMode;
  hidden?: boolean;
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

function isViewMode(value: string | undefined): value is ViewMode {
  return VIEW_MODES.some((mode) => mode.value === value);
}

export function ArticleListFooter({
  viewMode,
  hidden = false,
  modes,
  disabledModes,
  onSetViewMode,
}: ArticleListFooterProps) {
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
  const isFooterMounted = !hidden && visibleModes.length > 0;
  const notifyPassiveLayoutChange = useReaderPassiveLayoutNotify();

  // Mounting/unmounting the footer changes the list body's available height without necessarily
  // resizing the body element mid-transition; treat it as a known layout change explicitly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: isFooterMounted (not read in the body) is the intended trigger.
  useEffect(() => {
    notifyPassiveLayoutChange();
  }, [isFooterMounted, notifyPassiveLayoutChange]);

  if (!isFooterMounted) {
    return null;
  }

  return (
    <div className="flex min-h-11 items-center justify-center border-t border-[var(--subscriptions-pane-divider)] bg-[var(--workspace-header-surface)] px-4 backdrop-blur-sm">
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
              className={articleFilterInsetSelectionClassName}
            >
              {t(mode.labelKey)}
            </ArticleFilterToggleButton>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
