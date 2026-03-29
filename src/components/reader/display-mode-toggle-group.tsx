import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Columns3, Expand } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ReaderDisplayMode = "normal" | "widescreen";

export function DisplayModeToggleGroup({
  value,
  onValueChange,
  disabled = false,
}: {
  value: ReaderDisplayMode;
  onValueChange: (value: ReaderDisplayMode) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("reader");
  const options: Array<{ value: ReaderDisplayMode; label: string; icon: React.ReactNode }> = [
    { value: "normal", label: t("display_mode_normal"), icon: <Columns3 className="h-4 w-4" /> },
    { value: "widescreen", label: t("display_mode_widescreen"), icon: <Expand className="h-4 w-4" /> },
  ];

  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(groupValue) => {
        const nextValue = groupValue[0];
        if (nextValue) {
          onValueChange(nextValue as ReaderDisplayMode);
        }
      }}
      className="flex items-center rounded-lg border border-border bg-muted/40 p-1"
      aria-label={t("display_mode")}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={disabled}
          aria-label={option.label}
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
      ))}
    </ToggleGroup>
  );
}
