import type { ReactNode } from "react";
import { useId } from "react";
import { MOTION_CONTEXTUAL_SURFACE_CLASS_NAME } from "@/constants";
import { cn } from "@/lib/utils";

type LabeledControlRowA11y = {
  descriptionId: string | undefined;
};

type LabeledControlRowProps = {
  label: string;
  description?: string;
  children?: ReactNode | ((a11y: LabeledControlRowA11y) => ReactNode);
  htmlFor?: string;
  labelId?: string;
  descriptionId?: string;
  className?: string;
  leading?: ReactNode;
  labelClassName?: string;
};

export function LabeledControlRow({
  label,
  description,
  children,
  htmlFor,
  labelId,
  descriptionId,
  className,
  leading,
  labelClassName,
}: LabeledControlRowProps) {
  const generatedDescriptionId = useId();
  const resolvedDescriptionId = description ? (descriptionId ?? generatedDescriptionId) : undefined;
  const labelClasses = cn(
    "select-none font-sans text-[13px] leading-[1.35] font-medium text-[color:var(--form-row-label)]",
    labelClassName,
  );
  const resolvedChildren =
    typeof children === "function" ? children({ descriptionId: resolvedDescriptionId }) : children;
  const labelTextContent = (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className={labelClasses}>{label}</span>
      {description ? (
        <span id={resolvedDescriptionId} className="font-sans text-[13px] leading-[1.5] text-foreground-soft">
          {description}
        </span>
      ) : null}
    </span>
  );
  const labelContent = leading ? (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-1/72 text-foreground-soft">
        {leading}
      </span>
      {labelTextContent}
    </span>
  ) : (
    labelTextContent
  );

  return (
    <div
      className={cn(
        MOTION_CONTEXTUAL_SURFACE_CLASS_NAME,
        "grid min-h-[48px] grid-cols-1 items-start gap-y-2.5 border-b border-border/60 py-3 last:border-b-0 lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] lg:items-center lg:gap-x-8 lg:gap-y-3",
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
      <div className="min-w-0 overflow-visible lg:flex lg:items-center lg:justify-end lg:pr-2">{resolvedChildren}</div>
    </div>
  );
}
