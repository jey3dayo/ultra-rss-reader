import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useTranslation } from "react-i18next";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { ArticleDisplayPreset } from "@/lib/article-display";
import { cn } from "@/lib/utils";

export function DisplayModeToggleGroup({
  value,
  onValueChange,
  disabled = false,
}: {
  value: ArticleDisplayPreset;
  onValueChange: (value: ArticleDisplayPreset) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("reader");
  const options: Array<{ value: ArticleDisplayPreset; label: string; icon: React.ReactNode }> = [
    {
      value: "standard",
      label: t("display_mode_standard"),
      icon: <span className="text-xs font-semibold">S</span>,
    },
    {
      value: "preview",
      label: t("display_mode_preview"),
      icon: <span className="text-xs font-semibold">P</span>,
    },
  ];

  return (
    <TooltipProvider>
      <ToggleGroup
        value={[value]}
        onValueChange={(groupValue) => {
          const nextValue = groupValue[0];
          if (nextValue) {
            onValueChange(nextValue as ArticleDisplayPreset);
          }
        }}
        className="flex items-center rounded-lg border border-border bg-muted/40 p-1"
        aria-label={t("display_mode")}
      >
        {options.map((option) => (
          <AppTooltip key={option.value} label={option.label}>
            <Toggle
              value={option.value}
              disabled={disabled}
              aria-label={option.label}
              data-browser-overlay-return-focus={`display-preset-${option.value}`}
              className={(state) =>
                cn(
                  "inline-flex min-h-8 min-w-8 items-center justify-center rounded-md px-2 text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
                  state.pressed && "bg-background text-foreground shadow-sm",
                )
              }
            >
              {option.icon}
            </Toggle>
          </AppTooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}
