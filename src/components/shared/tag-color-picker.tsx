import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TagColorPickerProps = {
  label?: string;
  color: string | null;
  colorOptions: readonly string[];
  noColorLabel: string;
  optionAriaLabel: (color: string) => string;
  onChange: (value: string | null) => void;
};

export function TagColorPicker({
  label,
  color,
  colorOptions,
  noColorLabel,
  optionAriaLabel,
  onChange,
}: TagColorPickerProps) {
  return (
    <div className="space-y-3">
      {label ? <span className="block text-sm font-medium text-foreground-soft">{label}</span> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={color === null}
          aria-label={noColorLabel}
          title={noColorLabel}
          className={cn(
            "flex size-8 items-center justify-center rounded-full border bg-surface-1 text-[11px] text-foreground-soft transition-[background-color,border-color,box-shadow,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            color === null
              ? "border-border-strong bg-surface-2 text-foreground ring-2 ring-ring/35"
              : "border-border/70 hover:border-border-strong hover:bg-surface-2 hover:text-foreground",
          )}
          onClick={() => onChange(null)}
        >
          <span className="leading-none">X</span>
        </button>
        {colorOptions.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={color === option}
            aria-label={optionAriaLabel(option)}
            title={optionAriaLabel(option)}
            className={cn(
              "relative flex size-8 items-center justify-center rounded-full border-2 transition-[border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              color === option
                ? "scale-110 border-white/85 shadow-[0_0_0_1px_rgba(242,241,237,0.88),0_0_0_3px_rgba(245,78,0,0.16)]"
                : "border-border/60 hover:border-border-strong",
            )}
            style={{ backgroundColor: option }}
            onClick={() => onChange(option)}
          >
            {color === option ? <Check className="size-4 text-white drop-shadow-[0_1px_2px_rgba(38,37,30,0.45)]" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
