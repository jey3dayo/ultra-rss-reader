import { cn } from "@/lib/utils";
import type { LabeledControlRowProps } from "./form-row.types";

export function LabeledControlRow({
  label,
  description,
  children,
  htmlFor,
  labelId,
  className,
  labelClassName,
}: LabeledControlRowProps) {
  const labelClasses = cn("font-sans text-[14px] leading-[1.35] text-[color:var(--form-row-label)]", labelClassName);
  const labelContent = (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className={labelClasses}>{label}</span>
      {description ? (
        <span className="font-serif text-xs leading-[1.45] text-foreground-soft">{description}</span>
      ) : null}
    </span>
  );

  return (
    <div
      className={cn(
        "motion-contextual-surface grid min-h-[44px] grid-cols-1 items-start gap-y-2.5 border-b border-border/70 py-2.5 last:border-b-0 sm:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] sm:items-center sm:gap-x-7 sm:gap-y-3",
        className,
      )}
    >
      {htmlFor ? (
        <label id={labelId} htmlFor={htmlFor} className="min-w-0">
          {labelContent}
        </label>
      ) : (
        <span id={labelId} className="min-w-0">
          {labelContent}
        </span>
      )}
      <div className="min-w-0 sm:flex sm:items-center sm:justify-end">{children}</div>
    </div>
  );
}
