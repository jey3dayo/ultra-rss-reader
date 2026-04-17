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
  const labelClasses = cn("font-sans text-[14px] leading-[1.35] text-[color:var(--form-row-label)]", labelClassName);

  return (
    <div
      className={cn(
        "motion-contextual-surface grid min-h-[44px] grid-cols-1 items-start gap-y-2.5 border-b border-border/70 py-2.5 last:border-b-0 sm:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] sm:items-center sm:gap-x-7 sm:gap-y-3",
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
      <div className="min-w-0 sm:flex sm:items-center sm:justify-end">{children}</div>
    </div>
  );
}
