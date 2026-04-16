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
            "flex size-8 items-center justify-center rounded-full border bg-background text-[11px] text-muted-foreground transition-[border-color,box-shadow,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            color === null
              ? "border-foreground/25 ring-2 ring-foreground/15"
              : "border-border hover:border-foreground/20 hover:text-foreground-soft",
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
              "size-8 rounded-full border-2 transition-[border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              color === option
                ? "border-foreground/30 ring-2 ring-foreground/15"
                : "border-border/70 hover:border-foreground/20",
            )}
            style={{ backgroundColor: option }}
            onClick={() => onChange(option)}
          />
        ))}
      </div>
    </div>
  );
}
