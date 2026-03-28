import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { List } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";

type ViewMode = "all" | "unread" | "starred";

type ArticleListFooterProps = {
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
};

const VIEW_MODES = [
  { value: "unread", icon: null, labelKey: "filter_unread" },
  { value: "all", icon: "list", labelKey: "filter_all" },
  { value: "starred", icon: "star", labelKey: "filter_starred" },
] as const;

export function ArticleListFooter({ viewMode, onSetViewMode }: ArticleListFooterProps) {
  const { t } = useTranslation("reader");
  const handleChange = useCallback(
    (groupValue: string[]) => {
      const latest = groupValue[groupValue.length - 1] as ViewMode | undefined;
      if (latest) onSetViewMode(latest);
    },
    [onSetViewMode],
  );

  return (
    <div className="flex h-10 items-center justify-center border-t border-border bg-card">
      <ToggleGroup value={[viewMode]} onValueChange={handleChange}>
        {VIEW_MODES.map((mode) => {
          return (
            <Toggle
              key={mode.value}
              value={mode.value}
              aria-label={t(mode.labelKey)}
              className={controlChipVariants({ size: "compact", interaction: "toggle" })}
            >
              {mode.icon === "star" ? (
                <StarIcon starred={viewMode === "starred"} className={controlChipIconVariants({ size: "compact" })} />
              ) : mode.icon === "list" ? (
                <List className={controlChipIconVariants({ size: "compact" })} />
              ) : (
                <UnreadIcon unread className="h-3 w-3" />
              )}
              {t(mode.labelKey)}
            </Toggle>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
