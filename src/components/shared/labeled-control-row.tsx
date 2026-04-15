import { cn } from "@/lib/utils";
import type { LabeledControlRowProps } from "./form-row.types";

export function LabeledControlRow({
  label,
  children,
  htmlFor,
  labelId,
  className,
  labelClassName,
}: LabeledControlRowProps) {
  const labelClasses = cn("font-sans text-[14px] leading-[1.35] text-foreground/92", labelClassName);

  return (
    <div
      className={cn(
        "flex min-h-[44px] flex-col items-stretch justify-between gap-2.5 border-b border-border/70 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3",
        className,
      )}
    >
      {htmlFor ? (
        <label id={labelId} htmlFor={htmlFor} className={labelClasses}>
          {label}
        </label>
      ) : (
        <span id={labelId} className={labelClasses}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
