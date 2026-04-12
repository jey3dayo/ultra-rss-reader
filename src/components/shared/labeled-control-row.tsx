import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LabeledControlRowProps = {
  label: string;
  children?: ReactNode;
  htmlFor?: string;
  labelId?: string;
  className?: string;
  labelClassName?: string;
};

export function LabeledControlRow({
  label,
  children,
  htmlFor,
  labelId,
  className,
  labelClassName,
}: LabeledControlRowProps) {
  const labelClasses = cn("text-sm text-foreground", labelClassName);

  return (
    <div className={cn("flex min-h-[44px] items-center justify-between gap-3 border-b border-border py-3", className)}>
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
