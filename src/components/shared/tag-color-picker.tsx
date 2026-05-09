import { Check } from "lucide-react";
import { type KeyboardEvent, useId, useRef } from "react";
import { cn } from "@/lib/utils";

type TagColorPickerProps = {
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
  const labelId = useId();
  const radioName = useId();
  const radioRefs = useRef<Array<HTMLInputElement | null>>([]);
  const uniqueColorOptions = [...new Set(colorOptions)];
  const radioValues = [null, ...uniqueColorOptions] as const;
  const selectedIndex = radioValues.indexOf(color);
  const checkedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectByIndex = (index: number, shouldFocus = false) => {
    onChange(radioValues[index] ?? null);
    if (shouldFocus) {
      radioRefs.current[index]?.focus();
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    if (event.key === "Home") {
      selectByIndex(0, true);
      return;
    }
    if (event.key === "End") {
      selectByIndex(radioValues.length - 1, true);
      return;
    }

    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    selectByIndex((checkedIndex + direction + radioValues.length) % radioValues.length, true);
  };

  return (
    <div className="space-y-3">
      {label ? (
        <span id={labelId} className="block text-sm font-medium text-foreground-soft">
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={label ? labelId : undefined}
        className="flex flex-wrap items-center gap-1.5"
        onKeyDown={handleKeyDown}
      >
        <label title={noColorLabel}>
          <input
            ref={(node) => {
              radioRefs.current[0] = node;
            }}
            type="radio"
            name={radioName}
            checked={color === null}
            aria-label={noColorLabel}
            className="peer sr-only"
            tabIndex={checkedIndex === 0 ? 0 : -1}
            onChange={() => onChange(null)}
          />
          <span
            className={cn(
              "motion-interactive-surface flex size-8 items-center justify-center rounded-full border bg-surface-1 text-[11px] text-foreground-soft peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50",
              color === null
                ? "border-border-strong bg-surface-2 text-foreground ring-2 ring-ring/35"
                : "border-border/70 hover:border-border-strong hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <span className="leading-none">X</span>
          </span>
        </label>
        {uniqueColorOptions.map((option, optionIndex) => (
          <label key={option} title={optionAriaLabel(option)}>
            <input
              ref={(node) => {
                radioRefs.current[optionIndex + 1] = node;
              }}
              type="radio"
              name={radioName}
              checked={color === option}
              aria-label={optionAriaLabel(option)}
              className="peer sr-only"
              tabIndex={checkedIndex === optionIndex + 1 ? 0 : -1}
              onChange={() => onChange(option)}
            />
            <span
              className={cn(
                "motion-interactive-surface relative flex size-8 items-center justify-center rounded-full border-2 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50",
                color === option
                  ? "scale-110 border-white/85 shadow-[var(--tag-color-selected-shadow)]"
                  : "border-border/60 hover:border-border-strong",
              )}
              style={{ backgroundColor: option }}
            >
              {color === option ? (
                <Check className="size-4 text-white drop-shadow-[var(--tag-color-check-shadow)]" />
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
